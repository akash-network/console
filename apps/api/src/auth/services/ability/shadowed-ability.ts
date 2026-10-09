import type { LoggerService } from "@akashnetwork/logging";
import type { AbilityTuple, AnyAbility, CanParameters, MongoAbility, MongoQuery, RawRuleOf } from "@casl/ability";
import { fieldPatternMatcher, mongoQueryMatcher, PureAbility } from "@casl/ability";

/** Overrides `relevantRuleFor` rather than `can` because `ForbiddenError`, which `DrizzleAbility` throws through, never calls `can`. */
export class ShadowedAbility extends PureAbility<AbilityTuple, MongoQuery> {
  readonly #organizationAbility: AnyAbility;
  readonly #logger: LoggerService;

  constructor(legacyRules: RawRuleOf<MongoAbility>[], organizationAbility: AnyAbility, logger: LoggerService) {
    super(legacyRules, { conditionsMatcher: mongoQueryMatcher, fieldMatcher: fieldPatternMatcher });
    this.#organizationAbility = organizationAbility;
    this.#logger = logger;
  }

  relevantRuleFor(...args: CanParameters<AbilityTuple>) {
    const rule = super.relevantRuleFor(...args);
    this.#compareWithOrganizationAbility(args, !!rule && !rule.inverted);

    return rule;
  }

  #compareWithOrganizationAbility([action, subject, field]: CanParameters<AbilityTuple>, legacyAllowed: boolean) {
    try {
      const organizationAllowed = this.#organizationAbility.can(action, subject, field);

      if (organizationAllowed !== legacyAllowed) {
        this.#logger.warn({
          event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
          action,
          subjectType: this.detectSubjectType(subject),
          allowedBy: organizationAllowed ? "organization" : "legacy"
        });
      }
    } catch (error) {
      this.#logger.error({ event: "ORGANIZATION_ABILITY_SHADOW_FAILED", action, subjectType: this.detectSubjectType(subject), error });
    }
  }
}
