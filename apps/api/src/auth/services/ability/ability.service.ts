import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput } from "@src/user/repositories";
import { type AbilityRule, enabledRules, legacyRules, organizationRules, SUPER_USER_RULES } from "./ability-rules";
import { ShadowedAbility } from "./shadowed-ability";

type Role = "REGULAR_USER" | "REGULAR_PAYING_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = createMongoAbility([]);
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AbilityService.name });
  }

  getAbilityFor(role: Role, user: UserOutput): MongoAbility {
    if (role === "SUPER_USER") {
      return this.#toAbility(SUPER_USER_RULES);
    }

    const organizationContext = this.executionContextService.hasContext() ? this.executionContextService.get("ORGANIZATION_CONTEXT") : undefined;

    if (!organizationContext) {
      return this.#toAbility(legacyRules(user));
    }

    const organizationAbility = this.#toAbility(organizationRules(user, organizationContext));

    if (organizationContext.mode === "organization") {
      return organizationAbility;
    }

    return new ShadowedAbility(enabledRules(legacyRules(user), this.featureFlagsService), organizationAbility, this.#logger);
  }

  #toAbility(rules: AbilityRule[]) {
    return createMongoAbility(enabledRules(rules, this.featureFlagsService));
  }
}
