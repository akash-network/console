import { relations, sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const StripeCoupons = pgTable("stripe_coupons", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  stripeCouponId: varchar("stripe_coupon_id", { length: 255 }).unique().notNull(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
  stripeTransactionId: varchar("stripe_transaction_id", { length: 255 }).notNull(),
  couponCode: varchar("coupon_code", { length: 255 }),
  discountAmount: text("discount_amount"), // Store as string to preserve precision
  discountType: varchar("discount_type", { length: 50 }).notNull(), // 'fixed_amount' or 'percentage'
  currency: varchar("currency", { length: 10 }),
  metadata: jsonb("metadata"),
  stripeCreatedAt: timestamp("stripe_created_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const StripeCouponsRelations = relations(StripeCoupons, ({ one }) => ({
  user: one(Users, {
    fields: [StripeCoupons.userId],
    references: [Users.id]
  })
}));

export type StripeCoupon = typeof StripeCoupons.$inferSelect;
export type NewStripeCoupon = typeof StripeCoupons.$inferInsert;
