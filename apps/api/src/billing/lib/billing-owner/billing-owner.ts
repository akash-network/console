import { and, eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

/** Whose payment methods and transactions a query reads: a team organization's, or a user's own outside every team. */
export type BillingOwner = { organizationId: string } | { userId: string };

/** A user's own rows leave out those the user wrote for a team, since the team owns them. */
export function ownedBy(columns: { userId: PgColumn; organizationId: PgColumn }, owner: BillingOwner): SQL | undefined {
  if ("organizationId" in owner) {
    return eq(columns.organizationId, owner.organizationId);
  }

  return and(
    eq(columns.userId, owner.userId),
    sql`not exists (select 1 from ${Organizations} where ${Organizations.id} = ${columns.organizationId} and ${Organizations.type} = 'team')`
  );
}
