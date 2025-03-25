import { createMongoAbility, RawRule } from "@casl/ability";
import type { TemplateExecutor } from "lodash";
import template from "lodash/template";
import { singleton } from "tsyringe";

import { AuthConfigService } from "../auth-config/auth-config.service";

type Role = "REGULAR_USER" | "REGULAR_ANONYMOUS_USER" | "REGULAR_PAYING_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = createMongoAbility([]);

  private readonly RULES: Record<Role, RawRule[]> = {
    REGULAR_ANONYMOUS_USER: [
      {
        action: ["read", "sign"].concat(this.configService.get("ALLOW_ANONYMOUS_USER_TRIAL") ? "create" : []),
        subject: "UserWallet",
        conditions: { userId: "${user.id}" }
      },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } }
    ],
    REGULAR_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "read", subject: "StripePrice" },
      { action: "create", subject: "VerificationEmail", conditions: { id: "${user.id}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } }
    ],
    REGULAR_PAYING_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } },
      { action: "read", subject: "StripePrice" },
      { action: "create", subject: "VerificationEmail", conditions: { id: "${user.id}" } },
      { action: "manage", subject: "DeploymentSetting", conditions: { userId: "${user.id}" } },
      { action: "manage", subject: "ApiKey", conditions: { userId: "${user.id}" } }
    ],
    SUPER_USER: [{ action: "manage", subject: "all" }]
  };

  private readonly templates = (Object.keys(this.RULES) as Role[]).reduce(
    (acc, role) => {
      acc[role] = template(JSON.stringify(this.RULES[role]));
      return acc;
    },
    {} as Record<Role, TemplateExecutor>
  );

  constructor(private readonly configService: AuthConfigService) {}

  getAbilityFor(role: Role, user: { userId: string }) {
    return this.toAbility(this.templates[role]({ user }));
  }

  private toAbility(raw: string) {
    return createMongoAbility(JSON.parse(raw));
  }
}
