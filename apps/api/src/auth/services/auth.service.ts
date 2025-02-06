import { Ability, subject } from "@casl/ability";
import { Context } from "hono";
import assert from "http-assert";
import { container, Lifecycle, scoped } from "tsyringe";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { UserOutput } from "@src/user/repositories";
import { ApiKeyAuthService } from "./api-key/api-key-auth.service";

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

  throwUnlessCan(action: string, subjectName: string, payload?: Record<string, any>) {
    const identifiedPayload = payload ? subject(subjectName, payload) : subjectName;
    assert(this.ability.can(action, identifiedPayload), 403);
  }
}

type ProtectedOptions = {
  rules?: { action: string; subject: string }[];
  allowApiKey?: boolean;
};

export const Protected =
  (options?: ProtectedOptions | { action: string; subject: string }[]) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function protectedFunction(...args: any[]) {
      const [c] = args as [Context];
      const authService = container.resolve(AuthService);

      // Handle legacy array format
      const normalizedOptions: ProtectedOptions = Array.isArray(options) ? { rules: options } : options ?? { rules: [] };

      // Check for API key if enabled
      if (normalizedOptions.allowApiKey) {
        const apiKey = c.req.header("x-api-key");
        if (apiKey) {
          const apiKeyAuthService = container.resolve(ApiKeyAuthService);
          const isValidApiKey = await apiKeyAuthService.validateApiKeyFromHeader(apiKey);
          if (isValidApiKey) {
            return originalMethod.apply(this, args);
          }
        }
      }

      // Fall back to JWT auth
      assert(authService.isAuthenticated, 401);

      if (normalizedOptions.rules) {
        normalizedOptions.rules.forEach(rule => authService.throwUnlessCan(rule.action, rule.subject));
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
