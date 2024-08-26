import { Ability } from "@casl/ability";
import assert from "http-assert";
import { container, Lifecycle, scoped } from "tsyringe";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { UserOutput } from "@src/user/repositories";

@scoped(Lifecycle.ResolutionScoped)
export class AuthService {
  constructor(private readonly executionContextService: ExecutionContextService) {}

  set currentUser(user: UserOutput) {
    this.executionContextService.set("CURRENT_USER", user);
  }

  get currentUser(): UserOutput {
    return this.executionContextService.get("CURRENT_USER");
  }

  set ability(ability: Ability) {
    this.executionContextService.set("ABILITY", ability);
  }

  get ability(): Ability {
    return this.executionContextService.get("ABILITY");
  }

  get isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  throwUnlessCan(action: string, subject: string) {
    console.log("DEBUG this.ability", JSON.stringify(this.ability.rules, null, 2));
    assert(this.ability.can(action, subject), 403);
  }
}

export const Protected = (rules?: { action: string; subject: string }[]) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  descriptor.value = function protectedFunction(...args: any[]) {
    const authService = container.resolve(AuthService);
    console.log("DEBUG rules", JSON.stringify(rules, null, 2));
    if (rules) {
      rules.forEach(rule => authService.throwUnlessCan(rule.action, rule.subject));
    } else {
      assert(authService.isAuthenticated, 401);
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
};
