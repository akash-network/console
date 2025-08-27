import { decimal, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userSnapshot = pgTable("user_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull().defaultNow(),
  totalSpend: decimal("total_spend", { precision: 20, scale: 8 }).notNull().default("0"),
  totalCreditPurchases: integer("total_credit_purchases").notNull().default(0),
  couponsClaimed: integer("coupons_claimed").notNull().default(0),
  activeLeasesCount: integer("active_leases_count").notNull().default(0),
  totalAktSpent: decimal("total_akt_spent", { precision: 20, scale: 8 }).notNull().default("0"),
  totalUsdcSpent: decimal("total_usdc_spent", { precision: 20, scale: 8 }).notNull().default("0"),
  totalUsdSpent: decimal("total_usd_spent", { precision: 20, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export type UserSnapshot = typeof userSnapshot.$inferSelect;
export type NewUserSnapshot = typeof userSnapshot.$inferInsert;
