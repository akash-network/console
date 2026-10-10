import type { MongoAbility, MongoQuery } from "@casl/ability";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import type { OrganizationMembership, OrganizationRole, RequestIdentity } from "./request-identity";

type Builder = AbilityBuilder<MongoAbility>;

const UPDATABLE_ALERT_FIELDS = ["enabled", "name", "notificationChannelId", "conditions"];

const ROLES_MANAGING_EVERY_CHANNEL: readonly OrganizationRole[] = ["owner", "admin"];

const ROLES_MANAGING_ALERTS: readonly OrganizationRole[] = [...ROLES_MANAGING_EVERY_CHANNEL, "member"];

const ROLES_READING_ALERTS: readonly OrganizationRole[] = [...ROLES_MANAGING_ALERTS, "viewer"];

export function abilityFor(identity: RequestIdentity): MongoAbility {
  const builder = new AbilityBuilder<MongoAbility>(createMongoAbility);

  if (identity.membership) {
    defineOrganizationRules(builder, identity.membership, identity.userId);
  } else {
    defineUserRules(builder, identity);
  }

  return builder.build();
}

/** Keyed on the user as before organizations, narrowed to the minted organization and the rows not yet attributed to one. */
function defineUserRules({ can }: Builder, { userId, organizationId }: RequestIdentity): void {
  const ownedRows: MongoQuery[] = organizationId
    ? [
        { userId, organizationId },
        { userId, organizationId: null }
      ]
    : [{ userId }];

  for (const owned of ownedRows) {
    can("manage", "NotificationChannel", owned);
    can(["create", "read", "delete"], "Alert", owned);
    can("update", "Alert", UPDATABLE_ALERT_FIELDS, owned);
    can("manage", "DeploymentAlert", owned);
  }
}

function defineOrganizationRules({ can, cannot }: Builder, { organizationId, role, projectScope }: OrganizationMembership, userId: string): void {
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

  if (ROLES_MANAGING_EVERY_CHANNEL.includes(role)) {
    can("manage", "NotificationChannel", inOrganization);
  } else {
    can("manage", "NotificationChannel", { organizationId, userId });
    cannot(["update", "delete"], "NotificationChannel", { isDefault: true });
  }

  can(["create", "delete"], "Alert", inScope);
  can("update", "Alert", UPDATABLE_ALERT_FIELDS, inScope);
  can("manage", "DeploymentAlert", inScope);
}
