import { Ability } from "@casl/ability";
import template from "lodash/template";
import { singleton } from "tsyringe";

@singleton()
export class AbilityService {
  private readonly createRegularUserRules = template(
    JSON.stringify([
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}" } }
    ])
  );
  private readonly createRegularAnonymousUserRules = template(
    JSON.stringify([
      { action: ["create", "read", "sign"], subject: "UserWallet", conditions: { userId: "${user.id}" } },
      { action: "read", subject: "User", conditions: { id: "${user.id}", userId: null } }
    ])
  );

  getAbilityForUser(user: { userId: string }) {
    const rules = this.createRegularUserRules({ user });
    return new Ability(JSON.parse(rules));
  }

  getAbilityForAnonymousUser(user: { id: string }) {
    const rules = this.createRegularAnonymousUserRules({ user });
    return new Ability(JSON.parse(rules));
  }

  getEmptyAbility() {
    return new Ability([]);
  }

  getSuperUserAbility() {
    return new Ability([{ action: "manage", subject: "all" }]);
  }
}
