import { Ability, RawRule } from "@casl/ability";
import type { TemplateExecutor } from "lodash";
import template from "lodash/template";
import { singleton } from "tsyringe";

type Role = "REGULAR_USER" | "REGULAR_ANONYMOUS_USER" | "SUPER_USER";

@singleton()
export class AbilityService {
  readonly EMPTY_ABILITY = new Ability([]);

  private readonly RULES: Record<Role, RawRule[]> = {
    REGULAR_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } }
    ],
    REGULAR_ANONYMOUS_USER: [
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } }
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

  getAbilityFor(role: Role, user: { userId: string }) {
    return this.toAbility(this.templates[role]({ user }));
  }

  private toAbility(raw: string) {
    return new Ability(JSON.parse(raw));
  }
}
