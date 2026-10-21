import { sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type GpuBidCheckSource = "pricing-bot" | "user-deployment";

/** One row per provider a gpu check either expected a bid from or got one from. */
export const GpuBidChecks = pgTable(
  "gpu_bid_checks",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    provider: varchar("provider", { length: 255 }).notNull(),
    vendor: varchar("vendor", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    source: varchar("source", { length: 32 }).$type<GpuBidCheckSource>().notNull(),
    dseq: varchar("dseq", { length: 32 }).notNull(),
    screened: boolean("screened").notNull(),
    bid: boolean("bid").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull()
  },
  table => ({
    providerModelCheckedAtIdx: index("gpu_bid_checks_provider_model_checked_at_idx").on(table.provider, table.vendor, table.model, table.checkedAt),
    checkedAtIdx: index("gpu_bid_checks_checked_at_idx").on(table.checkedAt)
  })
);
