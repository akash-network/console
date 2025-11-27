import { createMongoAbility, RawRule } from "@casl/ability";
import type { TemplateExecutor } from "lodash";
import template from "lodash/template";
import { singleton } from "tsyringe";

import type { UserOutput } from "@src/user/repositories";

type Role = "REGULAR_USER" | "REGULAR_PAYING_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = createMongoAbility([]);

  private readonly RULES: Record<Role, Array<RawRule>> = {
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

  getAbilityFor(role: Role, user: UserOutput) {
    const compiledRules = this.compileRules();
    return this.toAbility(compiledRules[role]({ user }));
  }

  private compileRules() {
    this.compiledRules ??= (Object.keys(this.RULES) as Role[]).reduce(
      (acc, role) => {
        acc[role] = template(JSON.stringify(this.RULES[role]));
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
