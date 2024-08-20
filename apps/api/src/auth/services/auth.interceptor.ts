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
      const anonymousBearer = c.req.header("x-anonymous-authorization");
      const someBearer = c.req.header("authorization");
      const bearer = anonymousBearer || someBearer;

      const anonymousUserId = bearer && (await this.anonymousUserAuthService.getValidUserId(bearer));
      this.authService.ability = this.abilityService.EMPTY_ABILITY;

      console.log("DEBUG anonymousUserId", anonymousUserId);

      if (anonymousUserId) {
        const currentUser = await this.userRepository.findAnonymousById(anonymousUserId);

        this.authService.currentUser = currentUser;
        const ability = currentUser ? this.abilityService.getAbilityFor("REGULAR_ANONYMOUS_USER", currentUser) : this.abilityService.EMPTY_ABILITY;
        this.authService.ability.update([...this.authService.ability.rules, ...ability.rules]);
        console.log("DEBUG this.authService.ability", JSON.stringify(this.authService.ability.rules, null, 2));

        if (!anonymousBearer) {
          return await next();
        }
      }

      const userId = someBearer && (await this.getValidUserId(someBearer, c));

      console.log("DEBUG userId", userId);

      if (userId) {
        const currentUser = await this.userRepository.findByUserId(userId);

        if (currentUser) {
          this.authService.currentUser = currentUser;
        }

        const ability = currentUser
          ? this.abilityService.getAbilityFor("REGULAR_USER", currentUser)
          : this.abilityService.getAbilityFor("REGULAR_UNREGISTERED_USER", { userId });
        this.authService.ability.update([...this.authService.ability.rules, ...ability.rules]);
      }

      console.log("DEBUG this.authService.ability", JSON.stringify(this.authService.ability.rules, null, 2));

      return await next();
    };
  }

  private async getValidUserId(bearer: string, c: Context) {
    try {
      const token = bearer.replace(/^Bearer\s+/i, "");
      const jwks = await getJwks(env.Auth0JWKSUri || c.env?.JWKS_URI, useKVStore(kvStore || c.env?.VERIFY_RSA_JWT), c.env?.VERIFY_RSA_JWT_JWKS_CACHE_KEY);
      const result = await verify(token, jwks);

      return (result.payload as { sub: string }).sub;
    } catch (e) {
      return null;
    }
  }
}
