import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { singleton } from "tsyringe";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput } from "@src/user/repositories";
import { type AbilityRule, enabledRules, organizationRules, SUPER_USER_RULES } from "./ability-rules";

type Role = "REGULAR_USER" | "REGULAR_PAYING_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = createMongoAbility([]);

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  getAbilityFor(role: Role, user: UserOutput): MongoAbility {
    if (role === "SUPER_USER") {
      return this.#toAbility(SUPER_USER_RULES);
    }

    const organizationContext = this.executionContextService.hasContext() ? this.executionContextService.get("ORGANIZATION_CONTEXT") : undefined;

    if (!organizationContext) {
      return this.EMPTY_ABILITY;
    }

    return this.#toAbility(organizationRules(user, organizationContext, this.executionContextService.get("CURRENT_API_KEY")));
  }

  #toAbility(rules: AbilityRule[]) {
    return createMongoAbility(enabledRules(rules, this.featureFlagsService));
  }
}
