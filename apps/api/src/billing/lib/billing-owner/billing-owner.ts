import { and, eq, getTableName, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

/** Whose payment methods and transactions a query reads: a team organization's, or a user's own outside every team. */
export type BillingOwner = { organizationId: string } | { userId: string };

/** Named by identifier rather than by column, since relational queries re-alias every column to the table they read. */
const TEAMS = sql.identifier("billing_owner_teams");

/** A user's own rows leave out those the user wrote for a team, since the team owns them. */
export function ownedBy(columns: { userId: PgColumn; organizationId: PgColumn }, owner: BillingOwner): SQL | undefined {
  if ("organizationId" in owner) {
    return eq(columns.organizationId, owner.organizationId);
  }

  return and(
    eq(columns.userId, owner.userId),
    sql`not exists (select 1 from ${sql.identifier(getTableName(Organizations))} as ${TEAMS} where ${TEAMS}.${sql.identifier(Organizations.id.name)} = ${columns.organizationId} and ${TEAMS}.${sql.identifier(Organizations.type.name)} = 'team')`
  );
}
