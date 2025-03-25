import { LoggerService } from "@akashnetwork/logging";
import { secondsInMinute } from "date-fns";
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { LRUCache } from "lru-cache";
import { singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import { AuthTokenService } from "@src/auth/services/auth-token/auth-token.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { ApiKeyOutput, ApiKeyRepository } from "../repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "./api-key/api-key-auth.service";
import { UserAuthTokenService } from "./user-auth-token/user-auth-token.service";

const LAST_USER_ACTIVITY_THROTTLE_TIME_SECONDS = 30 * secondsInMinute;

@singleton()
export class AuthInterceptor implements HonoInterceptor {
  private readonly logger = LoggerService.forContext(AuthInterceptor.name);
  private readonly lastUserActivityCache = new LRUCache<string, Date>({
    max: 1e5,
    ttl: LAST_USER_ACTIVITY_THROTTLE_TIME_SECONDS * 1000,
    allowStale: true
  });

  constructor(
    private readonly abilityService: AbilityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly anonymousUserAuthService: AuthTokenService,
    private readonly userAuthService: UserAuthTokenService,
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

      const userId = bearer && (await this.userAuthService.getValidUserId(bearer, c.env));

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
          const currentUser = await this.userRepository.findById(apiKeyOutput.userId);

          await Promise.all([currentUser ? this.markApiKeyAsUsed(apiKeyOutput) : null, this.auth(currentUser)]);
          c.set("user", currentUser);

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
      await this.markUserAsActive(user.id);
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

  private shouldMarkUserAsActive(userId: UserOutput["id"], now: Date): boolean {
    const lastActiveAt = this.lastUserActivityCache.get(userId);
    return !lastActiveAt || now.getTime() - lastActiveAt.getTime() > this.lastUserActivityCache.ttl;
  }

  private async markUserAsActive(userId: string) {
    const now = new Date();
    if (this.shouldMarkUserAsActive(userId, now)) {
      this.lastUserActivityCache.set(userId, now);
      await this.userRepository.markAsActive(userId, LAST_USER_ACTIVITY_THROTTLE_TIME_SECONDS);
    }
  }

  private async markApiKeyAsUsed(apiKeyOutput?: ApiKeyOutput) {
    if (!apiKeyOutput || !this.shouldMarkUserAsActive(apiKeyOutput.userId, new Date())) return;
    await this.apiKeyRepository.markAsUsed(apiKeyOutput.id, LAST_USER_ACTIVITY_THROTTLE_TIME_SECONDS);
  }
}
