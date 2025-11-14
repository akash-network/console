import { createMongoAbility, RawRule } from "@casl/ability";
import type { TemplateExecutor } from "lodash";
import template from "lodash/template";
import { singleton } from "tsyringe";

import { FeatureFlags, FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput } from "@src/user/repositories";

type Role = "REGULAR_USER" | "REGULAR_ANONYMOUS_USER" | "REGULAR_PAYING_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = createMongoAbility([]);

  private readonly RULES: Record<Role, Array<RawRule & { enabledIf?: FeatureFlagValue }>> = {
    REGULAR_ANONYMOUS_USER: [
      { action: ["read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "create", subject: "UserWallet", conditions: { userId: "${user.id}" }, enabledIf: FeatureFlags.ANONYMOUS_FREE_TRIAL },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "verify-email", subject: "User", conditions: { email: "${user.email}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } }
    ],
    REGULAR_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "WalletSetting", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "verify-email", subject: "User", conditions: { email: "${user.email}" } },
      { action: ["create", "read", "delete"], subject: "StripePayment" },
      { action: "create", subject: "VerificationEmail", conditions: { id: "${user.id}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "Alert", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "NotificationChannel", conditions: { userId: "${user.id}" } }
    ],
    REGULAR_PAYING_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "WalletSetting", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "verify-email", subject: "User", conditions: { email: "${user.email}" } },
      { action: ["create", "read", "delete"], subject: "StripePayment" },
      { action: "create", subject: "VerificationEmail", conditions: { id: "${user.id}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "ApiKey", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "Alert", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "NotificationChannel", conditions: { userId: "${user.id}" } }
    ],
    SUPER_USER: [{ action: "manage", subject: "all" }]
  };

  private compiledRules?: Record<Role, TemplateExecutor>;

  constructor(private readonly featureFlagsService: FeatureFlagsService) {
    this.featureFlagsService.onChanged(() => {
      this.compiledRules = undefined;
    });
  }

  getAbilityFor(role: Role, user: UserOutput) {
    const compiledRules = this.compileRules();
    return this.toAbility(compiledRules[role]({ user }));
  }

  private compileRules() {
    this.compiledRules ??= (Object.keys(this.RULES) as Role[]).reduce(
      (acc, role) => {
        const rules = this.RULES[role].reduce<RawRule[]>((acc, { enabledIf, ...rule }) => {
          if (!enabledIf || this.featureFlagsService.isEnabled(enabledIf)) {
            acc.push(rule);
          }
          return acc;
        }, []);

        acc[role] = template(JSON.stringify(rules));
        return acc;
      },
      {} as Record<Role, TemplateExecutor>
    );

    return this.compiledRules;
  }

  private toAbility(raw: string) {
    return createMongoAbility(JSON.parse(raw));
  }
}
