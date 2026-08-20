import crc32c from "fast-crc32c";
import createError from "http-errors";
import { createDecipheriv } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
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

    if (typeof header.exp !== "number" || header.exp * 1000 <= Date.now()) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_EXPIRED", "Sealed secrets have expired", { exp: header.exp });
    }
  }

  #parseHeader(protectedHeader: string): SealHeader {
    try {
      return JSON.parse(Buffer.from(protectedHeader, "base64url").toString("utf8"));
    } catch {
      throw this.#reject(400, "SDL_SECRETS_SEAL_HEADER_UNREADABLE", "Sealed secrets carry an unreadable protected header", {});
    }
  }

  async #unwrapContentEncryptionKey(encryptedKey: string): Promise<Buffer> {
    const ciphertext = Buffer.from(encryptedKey, "base64url");

    const response = await this.#asymmetricDecrypt(ciphertext);

    if (!response.verifiedCiphertextCrc32c) {
      throw this.#reject(503, "SDL_SECRETS_CEK_REQUEST_CORRUPTED", "SDL secrets could not be unsealed", {});
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
      this.#loggerService.error({ event: "SDL_SECRETS_CEK_UNWRAP_FAILED", versionName: this.kmsTarget.versionName, error });

      throw createError(503, "Unable to reach the SDL secrets key management service");
    }
  }

  #decryptSecrets({ protectedHeader, iv, ciphertext, tag }: SealParts, contentEncryptionKey: Buffer): SdlSecrets {
    const decipher = createDecipheriv("aes-256-gcm", contentEncryptionKey, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(protectedHeader, "ascii"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    try {
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
