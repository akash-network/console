import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import { createDecipheriv } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { SDL_SECRETS_WRAPPED_KEY_BYTES } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";

export type KmsWrappedJweFailure =
  | "MALFORMED"
  | "HEADER_UNREADABLE"
  | "ENCRYPTED_KEY_INVALID"
  | "CIPHERTEXT_INVALID"
  | "IV_INVALID"
  | "TAG_INVALID"
  | "ENCRYPTED_KEY_REJECTED"
  | "KEY_SERVICE_UNREACHABLE"
  | "KEY_SERVICE_REQUEST_CORRUPTED"
  | "KEY_SERVICE_PLAINTEXT_MISSING"
  | "KEY_SERVICE_RESPONSE_CORRUPTED"
  | "AUTHENTICATION_FAILED";

/** Carries what went wrong without deciding whose fault it is: the same failure is a client error on the transport path and our own corruption at rest. */
export class KmsWrappedJweError extends Error {
  constructor(
    readonly failure: KmsWrappedJweFailure,
    readonly details: Record<string, unknown> = {}
  ) {
    super(failure);
    this.name = KmsWrappedJweError.name;
  }
}

interface JweSegments {
  protectedHeader: string;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

declare const PARSED_BY_KMS_WRAPPED_JWE_SERVICE: unique symbol;

/** Branded so `open` cannot be handed a literal that skipped the free checks and spend an unwrap on garbage. */
export interface ParsedKmsWrappedJwe {
  segments: JweSegments;
  header: Record<string, unknown>;
  readonly [PARSED_BY_KMS_WRAPPED_JWE_SERVICE]: true;
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

/** Validates nothing in the header, because what a header must say differs by caller and a wrapped data key carries none of a transport seal's claims. */
@singleton()
export class KmsWrappedJweService {
  constructor(@inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget) {}

  /** Everything here is free and nothing in `open` is, so a serialization whose own segments cannot be used never spends an unwrap. */
  parse(serialized: string): ParsedKmsWrappedJwe {
    const parts = serialized.split(".");

    if (parts.length !== COMPACT_JWE_PART_COUNT) {
      throw new KmsWrappedJweError("MALFORMED", { partCount: parts.length });
    }

    const [protectedHeader, encryptedKey, iv, ciphertext, tag] = parts;
    const segments = { protectedHeader, encryptedKey, iv, ciphertext, tag };

    this.#assertSegmentsAreWellFormed(segments);

    return { segments, header: this.#parseHeader(protectedHeader) } as ParsedKmsWrappedJwe;
  }

  async open({ segments }: ParsedKmsWrappedJwe): Promise<Buffer> {
    const contentEncryptionKey = await this.#unwrapContentEncryptionKey(segments.encryptedKey);

    return this.#openContent(segments, contentEncryptionKey);
  }

  #assertSegmentsAreWellFormed({ protectedHeader, encryptedKey, iv, ciphertext, tag }: JweSegments) {
    this.#assertSegmentIsBase64Url(protectedHeader, "HEADER_UNREADABLE");
    this.#assertSegmentIsBase64Url(ciphertext, "CIPHERTEXT_INVALID");

    const wrappedKeyBytes = this.#decodedByteLength(encryptedKey);

    if (!SDL_SECRETS_WRAPPED_KEY_BYTES.has(wrappedKeyBytes)) {
      throw new KmsWrappedJweError("ENCRYPTED_KEY_INVALID", { wrappedKeyBytes });
    }

    this.#assertSegmentDecodesTo(iv, CONTENT_ENCRYPTION_IV_BYTES, "IV_INVALID");
    this.#assertSegmentDecodesTo(tag, CONTENT_ENCRYPTION_TAG_BYTES, "TAG_INVALID");
  }

  #assertSegmentIsBase64Url(segment: string, failure: KmsWrappedJweFailure) {
    if (!isBase64Url(segment)) {
      throw new KmsWrappedJweError(failure);
    }
  }

  #assertSegmentDecodesTo(segment: string, expectedBytes: number, failure: KmsWrappedJweFailure) {
    const decodedBytes = this.#decodedByteLength(segment);

    if (decodedBytes !== expectedBytes) {
      throw new KmsWrappedJweError(failure, { decodedBytes, expectedBytes });
    }
  }

  #decodedByteLength(segment: string) {
    return isBase64Url(segment) ? Buffer.from(segment, "base64url").length : 0;
  }

  #parseHeader(protectedHeader: string): Record<string, unknown> {
    const header = this.#decodeHeaderJson(protectedHeader);

    if (!header || typeof header !== "object" || Array.isArray(header)) {
      throw new KmsWrappedJweError("HEADER_UNREADABLE");
    }

    return header as Record<string, unknown>;
  }

  #decodeHeaderJson(protectedHeader: string): unknown {
    try {
      return JSON.parse(Buffer.from(protectedHeader, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }

  /** `jose` cannot delegate key unwrapping to a remote service, which is why the encrypted key is handed to Cloud KMS here rather than opened by a stock library. */
  async #unwrapContentEncryptionKey(encryptedKey: string): Promise<Buffer> {
    const response = await this.#asymmetricDecrypt(Buffer.from(encryptedKey, "base64url"));

    if (!response.verifiedCiphertextCrc32c) {
      throw new KmsWrappedJweError("KEY_SERVICE_REQUEST_CORRUPTED");
    }

    if (!response.plaintext) {
      throw new KmsWrappedJweError("KEY_SERVICE_PLAINTEXT_MISSING");
    }

    const contentEncryptionKey = Buffer.from(response.plaintext as Uint8Array);

    if (crc32c.calculate(contentEncryptionKey) !== Number(response.plaintextCrc32c?.value)) {
      throw new KmsWrappedJweError("KEY_SERVICE_RESPONSE_CORRUPTED");
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
        throw new KmsWrappedJweError("ENCRYPTED_KEY_REJECTED");
      }

      throw new KmsWrappedJweError("KEY_SERVICE_UNREACHABLE", { versionName: this.kmsTarget.versionName, error });
    }
  }

  #openContent({ protectedHeader, iv, ciphertext, tag }: JweSegments, contentEncryptionKey: Buffer): Buffer {
    try {
      const decipher = createDecipheriv("aes-256-gcm", contentEncryptionKey, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(protectedHeader, "ascii"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));

      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]);
    } catch {
      throw new KmsWrappedJweError("AUTHENTICATION_FAILED");
    }
  }
}
