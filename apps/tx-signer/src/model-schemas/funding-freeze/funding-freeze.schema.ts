import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const fundingFreezes = pgTable("funding_freezes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reason: text("reason").notNull(),
  frozenBy: text("frozen_by").notNull(),
  frozenAt: timestamp("frozen_at", { withTimezone: true }).notNull().defaultNow(),
  liftedBy: text("lifted_by"),
  liftedAt: timestamp("lifted_at", { withTimezone: true })
});

export type FundingFreeze = typeof fundingFreezes.$inferSelect;
