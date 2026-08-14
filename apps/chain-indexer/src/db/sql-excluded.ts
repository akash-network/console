import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

/** References the proposed row's column inside an ON CONFLICT DO UPDATE clause. */
export function sqlExcluded(column: string): SQL {
  return sql.raw(`excluded.${column}`);
}
