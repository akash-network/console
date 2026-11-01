import { Trace } from "@akashnetwork/instrumentation";
import type { LoggerService } from "@akashnetwork/logging";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AuthConfigService } from "../auth-config/auth-config.service";

/** Bounds how long a signing key removed from Auth0 keeps verifying tokens. */
const JWKS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
/** Minimum gap between key set refetches triggered by tokens signed with an unknown key. */
const JWKS_REFETCH_COOLDOWN_MS = 30 * 1000;
const CLOCK_TOLERANCE_SECONDS = 30;

const TOKEN_REJECTIONS = [
  errors.JWTClaimValidationFailed,
  errors.JWTExpired,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys
];

@singleton()
export class UserAuthTokenService {
  readonly #authConfigService: AuthConfigService;
  readonly #logger: LoggerService;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(authConfigService: AuthConfigService, @inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#authConfigService = authConfigService;
    this.#logger = createLogger({ context: UserAuthTokenService.name });
    this.#jwks = createRemoteJWKSet(new URL(authConfigService.get("AUTH0_JWKS_URI")), {
      cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
      cooldownDuration: JWKS_REFETCH_COOLDOWN_MS
    });
  }

  @Trace()
  async getValidUserId(bearer: string): Promise<string | null> {
    const token = bearer.replace(/^Bearer\s+/i, "");

    try {
      const { payload } = await jwtVerify(token, this.#jwks, {
        algorithms: ["RS256"],
        issuer: this.#authConfigService.get("AUTH0_ISSUER"),
        audience: this.#authConfigService.get("AUTH0_AUDIENCE"),
        requiredClaims: ["exp", "sub"],
        clockTolerance: CLOCK_TOLERANCE_SECONDS
      });

      return payload.sub as string;
    } catch (error) {
      if (TOKEN_REJECTIONS.some(rejection => error instanceof rejection)) {
        this.#logger.info({ event: "ACCESS_TOKEN_REJECTED", reason: (error as errors.JOSEError).code });
        return null;
      }

      throw error;
    }
  }
}
