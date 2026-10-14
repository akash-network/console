import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

/** Rows a member wrote for a team organization, which the team keeps when that member's account is deleted. */
export function writtenForTeamBy(columns: { userId: PgColumn; organizationId: PgColumn }, userId: string): SQL {
  return sql`${columns.userId} = ${userId} and ${columns.organizationId} in (select ${Organizations.id} from ${Organizations} where ${Organizations.type} = 'team')`;
}
