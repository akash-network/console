import { sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import type { RegionArea } from "@src/gpu/lib/region-area/region-area";

export const UNMET_DEMAND_KINDS = ["no_fit", "missing_gpu", "zero_bid"] as const;

export type UnmetDemandKind = (typeof UNMET_DEMAND_KINDS)[number];

/** Anonymous by design: the asker only feeds the dedupe hash, so a row never names a user, org or wallet; a null model means any model. */
export const UnmetDemandEvents = pgTable(
  "unmet_demand_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    kind: varchar("kind", { length: 16 }).$type<UnmetDemandKind>().notNull(),
    vendor: varchar("vendor", { length: 64 }),
    model: varchar("model", { length: 255 }),
    gpuCount: integer("gpu_count").notNull(),
    regionArea: varchar("region_area", { length: 16 }).$type<RegionArea>(),
    dedupeKey: varchar("dedupe_key", { length: 64 }).notNull().unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull()
  },
  table => ({
    occurredAtIdx: index("unmet_demand_events_occurred_at_idx").on(table.occurredAt)
  })
);
