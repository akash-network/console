import type { MongoAbility, MongoQuery } from "@casl/ability";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import type { OrganizationMembership, OrganizationRole, RequestIdentity } from "./request-identity";

type Can = AbilityBuilder<MongoAbility>["can"];

const UPDATABLE_ALERT_FIELDS = ["enabled", "name", "notificationChannelId", "conditions"];

const ROLES_MANAGING_EVERY_CHANNEL: readonly OrganizationRole[] = ["owner", "admin"];

const ROLES_MANAGING_ALERTS: readonly OrganizationRole[] = [...ROLES_MANAGING_EVERY_CHANNEL, "member"];

const ROLES_READING_ALERTS: readonly OrganizationRole[] = [...ROLES_MANAGING_ALERTS, "viewer"];

export function abilityFor(identity: RequestIdentity): MongoAbility {
  const builder = new AbilityBuilder<MongoAbility>(createMongoAbility);

  if (identity.membership) {
    defineOrganizationRules(builder.can, identity.membership, identity.userId);
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

function defineOrganizationRules(can: Can, { organizationId, role, projectScope }: OrganizationMembership, userId: string): void {
  if (!ROLES_READING_ALERTS.includes(role)) {
    return;
  }

  const inOrganization: MongoQuery = { organizationId };
  const inScope: MongoQuery = projectScope.kind === "all" ? inOrganization : { organizationId, projectId: { $in: [...projectScope.projectIds] } };

  can("read", "NotificationChannel", inOrganization);
  can("read", ["Alert", "DeploymentAlert"], inScope);

  if (!ROLES_MANAGING_ALERTS.includes(role)) {
    return;
  }

  can("manage", "NotificationChannel", ROLES_MANAGING_EVERY_CHANNEL.includes(role) ? inOrganization : { organizationId, userId });
  can(["create", "delete"], "Alert", inScope);
  can("update", "Alert", UPDATABLE_ALERT_FIELDS, inScope);
  can("manage", "DeploymentAlert", inScope);
}
