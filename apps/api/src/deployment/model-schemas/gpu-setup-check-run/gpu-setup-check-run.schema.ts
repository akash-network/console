import { sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** One row per on-demand setup check deployment, counted against the daily cap. */
export const GpuSetupCheckRuns = pgTable(
  "gpu_setup_check_runs",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    dseq: varchar("dseq", { length: 32 }).notNull(),
    setupCount: integer("setup_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    createdAtIdx: index("gpu_setup_check_runs_created_at_idx").on(table.createdAt)
  })
);
