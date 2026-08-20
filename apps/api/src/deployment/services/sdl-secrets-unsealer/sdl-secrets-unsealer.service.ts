import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import createError from "http-errors";
import { createDecipheriv } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  SDL_SECRETS_CONTENT_ENCRYPTION,
  SDL_SECRETS_MAX_SEAL_LIFETIME_MS,
  SDL_SECRETS_SEAL_ALGORITHM,
  SDL_SECRETS_WRAPPED_KEY_BYTES
} from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";

export type SdlSecrets = Record<string, string>;

interface SealHeader {
  alg?: unknown;
  enc?: unknown;
  kid?: unknown;
  sub?: unknown;
  exp?: unknown;
}

interface SealParts {
  protectedHeader: string;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

const COMPACT_JWE_PART_COUNT = 5;

/** Buffer.from silently drops characters outside the alphabet, so a garbled segment would decode to a plausible length. */
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

/** base64url encodes in quanta of four characters; a leftover of exactly one carries no byte, and Buffer.from discards it as silently as it does a stray character. */
const BASE64URL_ORPHAN_CHARACTER_REMAINDER = 1;

function isBase64Url(segment: string) {
  return BASE64URL_SEGMENT.test(segment) && segment.length % 4 !== BASE64URL_ORPHAN_CHARACTER_REMAINDER;
}

/** A256GCM fixes the initialization vector at 96 bits, and Node accepts any other length without complaint. */
const CONTENT_ENCRYPTION_IV_BYTES = 12;

/** A256GCM fixes the tag at 128 bits, and Node silently accepts shorter ones — 4 bytes of authentication is not authentication. */
const CONTENT_ENCRYPTION_TAG_BYTES = 16;

/** gRPC reports the status of a failed call as a numeric `code` on the rejection. */
function getGrpcStatus(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/**
 * Opens a transport seal — one JWE holding all of a deployment's secrets.
 *
 * `jose` cannot delegate key unwrapping to a remote service, so the compact serialization is taken
 * apart by hand and each piece handed to a stock primitive. The only hand-written logic is the
 * split: the encrypted key goes to Cloud KMS, and the content is opened with AES-256-GCM using the
 * protected header's own ASCII as the additional authenticated data. That last detail is what makes
 * the header claims tamper-evident — altering `sub` or `exp` breaks the GCM tag.
 */
@singleton()
export class SdlSecretsUnsealerService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsUnsealerService.name });
  }

  async open(seal: string): Promise<SdlSecrets> {
    const parts = this.#splitSeal(seal);
    this.#assertSegmentsAreWellFormed(parts);
    this.#assertHeaderIsAcceptable(parts.protectedHeader);

    const contentEncryptionKey = await this.#unwrapContentEncryptionKey(parts.encryptedKey);
    const secrets = this.#decryptSecrets(parts, contentEncryptionKey);

    this.#loggerService.info({ event: "SDL_SECRETS_SEAL_OPENED", kid: this.kmsTarget.kid, secretCount: Object.keys(secrets).length });

    return secrets;
  }

  #splitSeal(seal: string): SealParts {
    const parts = seal.split(".");

    if (parts.length !== COMPACT_JWE_PART_COUNT) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_MALFORMED", "Sealed secrets must be a compact JWE", { partCount: parts.length });
    }

    const [protectedHeader, encryptedKey, iv, ciphertext, tag] = parts;

    return { protectedHeader, encryptedKey, iv, ciphertext, tag };
  }

  /** Everything here is free; nothing below it is. A malformed or stale seal must never reach Cloud KMS. */
  #assertHeaderIsAcceptable(protectedHeader: string) {
    const header = this.#parseHeader(protectedHeader);

    if (header.alg !== SDL_SECRETS_SEAL_ALGORITHM || header.enc !== SDL_SECRETS_CONTENT_ENCRYPTION) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_ALGORITHM_UNSUPPORTED", `Seals must use ${SDL_SECRETS_SEAL_ALGORITHM} and ${SDL_SECRETS_CONTENT_ENCRYPTION}`, {
        alg: header.alg,
        enc: header.enc
      });
    }

    if (header.kid !== this.kmsTarget.kid) {
      throw this.#reject(409, "SDL_SECRETS_SEAL_KID_UNKNOWN", "Sealed to a key the console no longer holds; refetch the SDL secrets context", {
        received: header.kid,
        expected: this.kmsTarget.kid
      });
    }

    if (header.sub !== this.authService.currentUser.id) {
      throw this.#reject(403, "SDL_SECRETS_SEAL_SUBJECT_MISMATCH", "Sealed for a different user", { received: header.sub });
    }

    const now = Date.now();

    if (typeof header.exp !== "number" || header.exp * 1000 <= now) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_EXPIRED", "Sealed secrets have expired", { exp: header.exp });
    }

    if (header.exp * 1000 > now + SDL_SECRETS_MAX_SEAL_LIFETIME_MS) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_LIFETIME_TOO_LONG", "Sealed secrets expire too far in the future", {
        exp: header.exp,
        maxLifetimeMs: SDL_SECRETS_MAX_SEAL_LIFETIME_MS
      });
    }
  }

  /** Also free, and for the same reason: a seal whose own segments cannot be used must never spend an unwrap. */
  #assertSegmentsAreWellFormed({ protectedHeader, encryptedKey, iv, ciphertext, tag }: SealParts) {
    this.#assertSegmentIsBase64Url(protectedHeader, "SDL_SECRETS_SEAL_HEADER_UNREADABLE", "Sealed secrets carry an unreadable protected header");
    this.#assertSegmentIsBase64Url(ciphertext, "SDL_SECRETS_SEAL_CIPHERTEXT_INVALID", "Sealed secrets carry a malformed ciphertext");

    const wrappedKeyBytes = this.#decodedByteLength(encryptedKey);

    if (!SDL_SECRETS_WRAPPED_KEY_BYTES.has(wrappedKeyBytes)) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_ENCRYPTED_KEY_INVALID", "Sealed secrets carry a malformed encrypted key", { wrappedKeyBytes });
    }

    this.#assertSegmentDecodesTo(iv, CONTENT_ENCRYPTION_IV_BYTES, "SDL_SECRETS_SEAL_IV_INVALID", "Sealed secrets carry a malformed initialization vector");
    this.#assertSegmentDecodesTo(tag, CONTENT_ENCRYPTION_TAG_BYTES, "SDL_SECRETS_SEAL_TAG_INVALID", "Sealed secrets carry a malformed authentication tag");
  }

  #assertSegmentIsBase64Url(segment: string, event: string, message: string) {
    if (!isBase64Url(segment)) {
      throw this.#reject(400, event, message, {});
    }
  }

  #assertSegmentDecodesTo(segment: string, expectedBytes: number, event: string, message: string) {
    const decodedBytes = this.#decodedByteLength(segment);

    if (decodedBytes !== expectedBytes) {
      throw this.#reject(400, event, message, { decodedBytes, expectedBytes });
    }
  }

  #decodedByteLength(segment: string) {
    return isBase64Url(segment) ? Buffer.from(segment, "base64url").length : 0;
  }

  #parseHeader(protectedHeader: string): SealHeader {
    const header = this.#decodeHeaderJson(protectedHeader);

    if (!header || typeof header !== "object" || Array.isArray(header)) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_HEADER_UNREADABLE", "Sealed secrets carry an unreadable protected header", {});
    }

    return header;
  }

  #decodeHeaderJson(protectedHeader: string): unknown {
    try {
      return JSON.parse(Buffer.from(protectedHeader, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }

  async #unwrapContentEncryptionKey(encryptedKey: string): Promise<Buffer> {
    const ciphertext = Buffer.from(encryptedKey, "base64url");

    const response = await this.#asymmetricDecrypt(ciphertext);

    if (!response.verifiedCiphertextCrc32c) {
      throw this.#reject(503, "SDL_SECRETS_CEK_REQUEST_CORRUPTED", "SDL secrets could not be unsealed", {});
    }

    if (!response.plaintext) {
      throw this.#reject(503, "SDL_SECRETS_CEK_MISSING", "SDL secrets could not be unsealed", {});
    }

    const contentEncryptionKey = Buffer.from(response.plaintext as Uint8Array);

    if (crc32c.calculate(contentEncryptionKey) !== Number(response.plaintextCrc32c?.value)) {
      throw this.#reject(503, "SDL_SECRETS_CEK_RESPONSE_CORRUPTED", "SDL secrets could not be unsealed", {});
    }

    return contentEncryptionKey;
  }

  async #asymmetricDecrypt(ciphertext: Buffer) {
    try {
      const [response] = await this.kmsTarget.client.asymmetricDecrypt({
        name: this.kmsTarget.versionName,
        ciphertext,
        ciphertextCrc32c: { value: crc32c.calculate(ciphertext) }
      });

      return response;
    } catch (error) {
      if (getGrpcStatus(error) === grpc.status.INVALID_ARGUMENT) {
        throw this.#reject(400, "SDL_SECRETS_SEAL_ENCRYPTED_KEY_REJECTED", "Sealed secrets carry an encrypted key this key version cannot open", {});
      }

      this.#loggerService.error({ event: "SDL_SECRETS_CEK_UNWRAP_FAILED", versionName: this.kmsTarget.versionName, error });

      throw createError(503, "Unable to reach the SDL secrets key management service");
    }
  }

  #decryptSecrets({ protectedHeader, iv, ciphertext, tag }: SealParts, contentEncryptionKey: Buffer): SdlSecrets {
    try {
      const decipher = createDecipheriv("aes-256-gcm", contentEncryptionKey, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(protectedHeader, "ascii"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));

      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);

      return this.#parseSecrets(plaintext);
    } catch (error) {
      if (createError.isHttpError(error)) {
        throw error;
      }

      throw this.#reject(400, "SDL_SECRETS_SEAL_TAMPERED", "Sealed secrets failed authentication", {});
    }
  }

  #parseSecrets(plaintext: Buffer): SdlSecrets {
    const secrets = JSON.parse(plaintext.toString("utf8"));

    if (!secrets || typeof secrets !== "object" || Array.isArray(secrets) || Object.values(secrets).some(value => typeof value !== "string")) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_PAYLOAD_INVALID", "Sealed secrets must be a flat object of string values", {});
    }

    return secrets;
  }

  #reject(status: number, event: string, message: string, details: Record<string, unknown>) {
    this.#loggerService.warn({ event, ...details });

    return createError(status, message);
  }
}
