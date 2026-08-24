import crc32c from "fast-crc32c";
import createError from "http-errors";
import type { KeyObject } from "node:crypto";
import { createPublicKey } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  SDL_SECRETS_SEAL_ALGORITHM,
  SDL_SECRETS_SEALING_KEY_ALGORITHMS,
  SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE
} from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";

export interface SdlSecretsPublicJwk {
  kty: string;
  n: string;
  e: string;
  use: string;
  alg: string;
}

export interface SdlSecretsSealingKey {
  kid: string;
  publicKey: KeyObject;
  jwk: SdlSecretsPublicJwk;
}

/**
 * Holds the public half of the SDL secrets KMS key. Wrapping and publishing both need only this
 * half, so every consumer works off one verified in-memory copy instead of spending a KMS read.
 */
@singleton()
export class SdlSecretsSealingKeyService {
  #sealingKeyPromise?: Promise<SdlSecretsSealingKey>;
  #heldSealingKey?: SdlSecretsSealingKey;
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsSealingKeyService.name });
  }

  /**
   * Serving a cached key means a KMS outage cannot take this endpoint down and traffic does not
   * consume the read quota. A failed fetch is not cached, so the next caller retries.
   */
  getSealingKey(): Promise<SdlSecretsSealingKey> {
    if (!this.#sealingKeyPromise) {
      this.#sealingKeyPromise = this.#fetchSealingKey()
        .then(sealingKey => {
          this.#heldSealingKey = sealingKey;

          return sealingKey;
        })
        .catch(error => {
          this.#sealingKeyPromise = undefined;
          throw error;
        });
    }

    return this.#sealingKeyPromise;
  }

  /**
   * The sealing key only if it is already in memory, plus a fetch started for the next caller when
   * it is not. Request paths that must not depend on KMS availability — signup above all — read the
   * key this way: an unreachable key service stalls a fetch for as long as its own timeouts allow,
   * and a request that merely wants to wrap a key cannot afford to wait on that. The started fetch
   * logs its own failure, so a cold key heals without anything blocking on it.
   */
  peekSealingKey(): SdlSecretsSealingKey | undefined {
    if (!this.#heldSealingKey) {
      this.getSealingKey().catch(() => undefined);
    }

    return this.#heldSealingKey;
  }

  async #fetchSealingKey(): Promise<SdlSecretsSealingKey> {
    const { versionName, kid } = this.kmsTarget;
    const publicKey = await this.#readPublicKey(this.kmsTarget);

    if (publicKey.name !== versionName) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_NAME_MISMATCH", { expected: versionName, received: publicKey.name });
    }

    if (!publicKey.pem) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_PEM_MISSING", { versionName });
    }

    if (crc32c.calculate(publicKey.pem) !== Number(publicKey.pemCrc32c?.value)) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_CHECKSUM_MISMATCH", { versionName });
    }

    if (!SDL_SECRETS_SEALING_KEY_ALGORITHMS.has(publicKey.algorithm ?? "")) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_ALGORITHM_UNSUPPORTED", { versionName, algorithm: publicKey.algorithm });
    }

    this.#loggerService.info({ event: "SDL_SECRETS_KEY_PUBLISHED", kid, algorithm: publicKey.algorithm });

    return { kid, ...this.#toSealingKeyMaterial(publicKey.pem) };
  }

  async #readPublicKey({ client, versionName }: SdlSecretsKmsTarget) {
    try {
      const [publicKey] = await client.getPublicKey(
        { name: versionName },
        {
          timeout: 5000
        }
      );

      return publicKey;
    } catch (error) {
      this.#loggerService.error({ event: "SDL_SECRETS_KEY_FETCH_FAILED", versionName, error });

      throw createError(503, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE);
    }
  }

  #rejectUntrustworthyKey(event: string, details: Record<string, unknown>) {
    this.#loggerService.error({ event, ...details });

    return createError(503, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE);
  }

  #toSealingKeyMaterial(pem: string): Omit<SdlSecretsSealingKey, "kid"> {
    const publicKey = this.#createPublicKey(pem);
    const { kty, n, e } = publicKey.export({ format: "jwk" });

    if (kty !== "RSA" || !n || !e) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_NOT_RSA", { kty });
    }

    return { publicKey, jwk: { kty, n, e, use: "enc", alg: SDL_SECRETS_SEAL_ALGORITHM } };
  }

  #createPublicKey(pem: string) {
    try {
      return createPublicKey(pem);
    } catch (error) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_PEM_UNPARSABLE", { error });
    }
  }
}
