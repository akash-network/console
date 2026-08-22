import crc32c from "fast-crc32c";
import createError from "http-errors";
import { createPublicKey } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { SDL_SECRETS_REQUIRED_CLAIMS, SDL_SECRETS_SEAL_ALGORITHM, SDL_SECRETS_SEALING_KEY_ALGORITHMS } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";

export interface SdlSecretsPublicJwk {
  kty: string;
  n: string;
  e: string;
  use: string;
  alg: string;
}

export interface SdlSecretsContext {
  kid: string;
  sub: string;
  jwk: SdlSecretsPublicJwk;
  requiredClaims: Array<(typeof SDL_SECRETS_REQUIRED_CLAIMS)[number]>;
}

interface SealingKey {
  kid: string;
  jwk: SdlSecretsPublicJwk;
}

@singleton()
export class SdlSecretsContextService {
  #sealingKeyPromise?: Promise<SealingKey>;
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsContextService.name });
  }

  async getContext(): Promise<SdlSecretsContext> {
    const { kid, jwk } = await this.#getSealingKey();

    return {
      kid,
      sub: this.authService.currentUser.id,
      jwk,
      requiredClaims: [...SDL_SECRETS_REQUIRED_CLAIMS]
    };
  }

  /**
   * Serving a cached key means a KMS outage cannot take this endpoint down and traffic does not
   * consume the read quota. A failed fetch is not cached, so the next caller retries.
   */
  #getSealingKey(): Promise<SealingKey> {
    if (!this.#sealingKeyPromise) {
      this.#sealingKeyPromise = this.#fetchSealingKey().catch(error => {
        this.#sealingKeyPromise = undefined;
        throw error;
      });
    }

    return this.#sealingKeyPromise;
  }

  async #fetchSealingKey(): Promise<SealingKey> {
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

    return { kid, jwk: this.#toSealingJwk(publicKey.pem) };
  }

  async #readPublicKey({ client, versionName }: SdlSecretsKmsTarget) {
    try {
      const [publicKey] = await client.getPublicKey({ name: versionName });

      return publicKey;
    } catch (error) {
      this.#loggerService.error({ event: "SDL_SECRETS_KEY_FETCH_FAILED", versionName, error });

      throw createError(503, "Unable to reach the SDL secrets key management service");
    }
  }

  #rejectUntrustworthyKey(event: string, details: Record<string, unknown>) {
    this.#loggerService.error({ event, ...details });

    return createError(503, "SDL secrets encryption key could not be verified");
  }

  #toSealingJwk(pem: string): SdlSecretsPublicJwk {
    const { kty, n, e } = this.#exportJwk(pem);

    if (kty !== "RSA" || !n || !e) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_NOT_RSA", { kty });
    }

    return { kty, n, e, use: "enc", alg: SDL_SECRETS_SEAL_ALGORITHM };
  }

  #exportJwk(pem: string) {
    try {
      return createPublicKey(pem).export({ format: "jwk" });
    } catch (error) {
      throw this.#rejectUntrustworthyKey("SDL_SECRETS_KEY_PEM_UNPARSABLE", { error });
    }
  }
}
