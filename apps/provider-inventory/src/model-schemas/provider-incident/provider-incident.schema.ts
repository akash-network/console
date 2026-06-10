import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const providerIncidents = pgTable(
  "provider_incidents",
  {
    provider: text("provider").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true })
  },
  table => ({
    openIncidentUnique: uniqueIndex("uniq_provider_incidents_open_per_provider")
      .on(table.provider)
      .where(sql`ended_at IS NULL`),
    providerStartedAtIdx: index("idx_incidents_provider").on(table.provider, table.startedAt)
  })
);
