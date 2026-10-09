import type { MongoAbility, MongoQuery } from "@casl/ability";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import type { OrganizationMembership, OrganizationRole, RequestIdentity } from "./request-identity";

type Can = AbilityBuilder<MongoAbility>["can"];

const UPDATABLE_ALERT_FIELDS = ["enabled", "name", "notificationChannelId", "conditions"];

const ROLES_MANAGING_ALERTS: readonly OrganizationRole[] = ["owner", "admin", "member"];

export function abilityFor(identity: RequestIdentity): MongoAbility {
  const builder = new AbilityBuilder<MongoAbility>(createMongoAbility);

  if (identity.membership) {
    defineOrganizationRules(builder.can, identity.membership);
  } else {
    defineUserRules(builder.can, identity.userId);
  }

  return builder.build();
}

function defineUserRules(can: Can, userId: string): void {
  can("manage", "NotificationChannel", { userId });
  can(["create", "read", "delete"], "Alert", { userId });
  can("update", "Alert", UPDATABLE_ALERT_FIELDS, { userId });
  can("manage", "DeploymentAlert", { userId });
}

function defineOrganizationRules(can: Can, { organizationId, role, projectScope }: OrganizationMembership): void {
  const inOrganization: MongoQuery = { organizationId };
  const inScope: MongoQuery = projectScope.kind === "all" ? inOrganization : { organizationId, projectId: { $in: [...projectScope.projectIds] } };

  if (ROLES_MANAGING_ALERTS.includes(role)) {
    can("manage", "NotificationChannel", inOrganization);
    can(["create", "read", "delete"], "Alert", inScope);
    can("update", "Alert", UPDATABLE_ALERT_FIELDS, inScope);
    can("manage", "DeploymentAlert", inScope);
  } else if (role === "viewer") {
    can("read", "NotificationChannel", inOrganization);
    can("read", ["Alert", "DeploymentAlert"], inScope);
  }
}
