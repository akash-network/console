import { integer, numeric, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { MAX_POOL_KEY_LENGTH } from "../gpu-waitlist-entry/gpu-waitlist-entry.schema";

export const GpuWaitlistPools = pgTable("gpu_waitlist_pools", {
  poolKey: varchar("pool_key", { length: MAX_POOL_KEY_LENGTH }).primaryKey().notNull(),
  lastFreeUnits: integer("last_free_units").notNull(),
  lastMaxNodeFreeUnits: integer("last_max_node_free_units").notNull(),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  lastCheckPriceUsdPerHour: numeric("last_check_price_usd_per_hour", { mode: "number" }),
  waveStartedAt: timestamp("wave_started_at", { withTimezone: true }),
  waveNumber: integer("wave_number").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
