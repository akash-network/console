import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { kvStore } from "@src/middlewares/userMiddleware";
import { UserRepository } from "@src/user/repositories";
import { env } from "@src/utils/env";
import { getJwks, useKVStore, verify } from "@src/verify-rsa-jwt-cloudflare-worker-main";

@singleton()
export class AuthInterceptor implements HonoInterceptor {
  constructor(
    private readonly abilityService: AbilityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly anonymousUserAuthService: AuthTokenService
  ) {}

  intercept() {
    return async (c: Context, next: Next) => {
      const bearer = c.req.header("authorization");
      const anonymousBearer = c.req.header("x-anonymous-authorization");

      const anonymousUserId = bearer && (await this.anonymousUserAuthService.getValidUserId(bearer));

      if (anonymousUserId) {
        const currentUser = await this.userRepository.findAnonymousById(anonymousUserId);

        this.authService.currentUser = currentUser;
        this.authService.ability = currentUser ? this.abilityService.getAbilityFor("REGULAR_ANONYMOUS_USER", currentUser) : this.abilityService.EMPTY_ABILITY;

        return await next();
      }

      const userId = bearer && (await this.getValidUserId(bearer, c));

      if (userId) {
        const currentUser = await this.userRepository.findByUserId(userId);

        this.authService.currentUser = currentUser;
        this.authService.ability = currentUser
          ? this.abilityService.getAbilityFor("REGULAR_USER", currentUser)
          : this.abilityService.getAbilityFor("REGULAR_UNREGISTERED_USER", { userId });

        return await next();
      }

      this.authService.ability = this.abilityService.EMPTY_ABILITY;

      return await next();
    };
  }

  private async getValidUserId(bearer: string, c: Context) {
    const token = bearer.replace(/^Bearer\s+/i, "");
    const jwks = await getJwks(env.Auth0JWKSUri || c.env?.JWKS_URI, useKVStore(kvStore || c.env?.VERIFY_RSA_JWT), c.env?.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
    const result = await verify(token, jwks);

    return (result.payload as { sub: string }).sub;
  }
}
