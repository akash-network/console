import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** A block reaches every subdomain of its domain, so each query that guards or carries one out must match them too. */
export function isEmailWithinDomain(email: PgColumn, domain: string): SQL {
  return sql`(lower(${email}) LIKE ${"%@"} || ${domain} OR lower(${email}) LIKE ${"%@%."} || ${domain})`;
}
