import { LoggerService } from "@akashnetwork/logging";
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { kvStore } from "@src/middlewares/userMiddleware";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { toUTC } from "@src/utils";
import { env } from "@src/utils/env";
import { getJwks, useKVStore, verify } from "@src/verify-rsa-jwt-cloudflare-worker-main";
import { ApiKeyRepository } from "../repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "./api-key/api-key-auth.service";

@singleton()
export class AuthInterceptor implements HonoInterceptor {
  private readonly logger = LoggerService.forContext(AuthInterceptor.name);

  constructor(
    private readonly abilityService: AbilityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly anonymousUserAuthService: AuthTokenService,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly apiKeyAuthService: ApiKeyAuthService
  ) {}

  intercept() {
    return async (c: Context, next: Next) => {
      const bearer = c.req.header("authorization");

      const anonymousUserId = bearer && (await this.anonymousUserAuthService.getValidUserId(bearer));

      if (anonymousUserId) {
        const currentUser = await this.userRepository.findAnonymousById(anonymousUserId);
        await this.auth(currentUser);
        c.set("user", currentUser);
        return await next();
      }

      const userId = bearer && (await this.getValidUserId(bearer, c));

      if (userId) {
        const currentUser = await this.userRepository.findByUserId(userId);
        await this.auth(currentUser);
        c.set("user", currentUser);
        return await next();
      }

      const apiKey = c.req.header("x-api-key");

      if (apiKey) {
        try {
          const apiKeyOutput = await this.apiKeyAuthService.getAndValidateApiKeyFromHeader(apiKey);
          const currentUser = await this.userRepository.findByUserId(apiKeyOutput.userId);
          await this.auth(currentUser);
          c.set("user", currentUser);

          if (apiKeyOutput && currentUser) {
            await this.apiKeyRepository.updateById(apiKeyOutput.id, {
              lastUsedAt: toUTC(new Date())
            });
          }

          return await next();
        } catch (error) {
          this.logger.error(error);
          throw new HTTPException(401, {
            message: "Invalid API key"
          });
        }
      }

      this.authService.ability = this.abilityService.EMPTY_ABILITY;
      return await next();
    };
  }

  private async auth(user?: UserOutput) {
    this.authService.currentUser = user;
    if (user) {
      this.authService.ability = this.abilityService.getAbilityFor(this.getUserRole(user), user);
      await this.userRepository.markAsActive(user.id);
    } else {
      this.authService.ability = this.abilityService.EMPTY_ABILITY;
    }
  }

  private getUserRole(user: UserOutput) {
    if (user.userId) {
      return user.trial === false ? "REGULAR_PAYING_USER" : "REGULAR_USER";
    }

    return "REGULAR_ANONYMOUS_USER";
  }

  private async getValidUserId(bearer: string, c: Context) {
    const token = bearer.replace(/^Bearer\s+/i, "");
    const jwks = await getJwks(env.AUTH0_JWKS_URI || c.env?.JWKS_URI, useKVStore(kvStore || c.env?.VERIFY_RSA_JWT), c.env?.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
    const result = await verify(token, jwks);

    return (result.payload as { sub: string }).sub;
  }
}
