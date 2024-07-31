import { Context, Next } from "hono";
import { singleton } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";
import { getCurrentUserId } from "@src/middlewares/userMiddleware";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class AuthInterceptor implements HonoInterceptor {
  constructor(
    private readonly abilityService: AbilityService,
    private readonly userRepository: UserRepository,
    private readonly executionContextService: ExecutionContextService,
    private readonly authService: AuthService
  ) {}

  intercept() {
    return async (c: Context, next: Next) => {
      const userId = getCurrentUserId(c);

      if (userId) {
        const currentUser = await this.userRepository.findByUserId(userId);

        this.authService.currentUser = currentUser;
        this.authService.ability = currentUser ? this.abilityService.getAbilityForUser(currentUser) : this.abilityService.getEmptyAbility();

        return await next();
      }
      const anonymousUserId = c.req.header("x-anonymous-user-id");

      if (anonymousUserId) {
        const currentUser = await this.userRepository.findAnonymousById(anonymousUserId);

        this.authService.currentUser = currentUser;
        this.authService.ability = currentUser ? this.abilityService.getAbilityForAnonymousUser(currentUser) : this.abilityService.getEmptyAbility();

        return await next();
      }

      this.authService.ability = this.abilityService.getEmptyAbility();

      return await next();
    };
  }
}
