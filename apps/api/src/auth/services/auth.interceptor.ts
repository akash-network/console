import { LoggerService } from "@akashnetwork/logging";
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { kvStore } from "@src/middlewares/userMiddleware";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { env } from "@src/utils/env";
import { getJwks, useKVStore, verify } from "@src/verify-rsa-jwt-cloudflare-worker-main";
import { ApiKeyAuthService } from "./api-key/api-key-auth.service";

@singleton()
export class AuthInterceptor implements HonoInterceptor {
  private readonly logger = LoggerService.forContext(AuthInterceptor.name);

  constructor(
    private readonly abilityService: AbilityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly anonymousUserAuthService: AuthTokenService,
    private readonly apiKeyAuthService: ApiKeyAuthService
  ) {}

  intercept() {
    return async (c: Context, next: Next) => {
      try {
        const bearer = c.req.header("authorization");

        const anonymousUserId = bearer && (await this.anonymousUserAuthService.getValidUserId(bearer));

        if (anonymousUserId) {
          const currentUser = await this.userRepository.findAnonymousById(anonymousUserId);
          assert(currentUser, 401, "Invalid anonymous user");
          await this.auth(currentUser);
          c.set("user", currentUser);
          return await next();
        }

        const userId = bearer && (await this.getValidUserId(bearer, c));

        if (userId) {
          const currentUser = await this.userRepository.findByUserId(userId);
          assert(currentUser, 401, "Invalid user");
          await this.auth(currentUser);
          c.set("user", currentUser);
          return await next();
        }

        const apiKey = c.req.header("x-api-key");

        if (apiKey) {
          const apiKeyOutput = await this.apiKeyAuthService.getAndValidateApiKeyFromHeader(apiKey);
          const currentUser = await this.userRepository.findByUserId(apiKeyOutput.userId);
          assert(currentUser, 401, "Invalid API key user");
          await this.auth(currentUser);
          c.set("user", currentUser);
          return await next();
        }

        this.authService.ability = this.abilityService.EMPTY_ABILITY;
        return await next();
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        this.logger.error(error);

        throw new HTTPException(500, { message: "Authentication failed" });
      }
    };
  }

  private async auth(user?: UserOutput) {
    this.authService.currentUser = user;
    if (user) {
      this.authService.ability = this.abilityService.getAbilityFor(user.userId ? "REGULAR_USER" : "REGULAR_ANONYMOUS_USER", user);
      await this.userRepository.markAsActive(user.id);
    } else {
      this.authService.ability = this.abilityService.EMPTY_ABILITY;
    }
  }

  private async getValidUserId(bearer: string, c: Context) {
    const token = bearer.replace(/^Bearer\s+/i, "");
    const jwks = await getJwks(env.AUTH0_JWKS_URI || c.env?.JWKS_URI, useKVStore(kvStore || c.env?.VERIFY_RSA_JWT), c.env?.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
    const result = await verify(token, jwks);

    return (result.payload as { sub: string }).sub;
  }
}
