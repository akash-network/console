import { relations, sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const stripeTransactionStatusEnum = pgEnum("stripe_transaction_status", [
  "created",
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "refunded",
  "canceled"
]);

export const stripeTransactionTypeEnum = pgEnum("stripe_transaction_type", ["payment_intent", "coupon_claim", "manual_credit"]);

export const StripeTransactions = pgTable(
  "stripe_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    type: stripeTransactionTypeEnum("type").notNull(),
    status: stripeTransactionStatusEnum("status").notNull().default("created"),
    amount: integer("amount").notNull(), // Amount in cents
    amountRefunded: integer("amount_refunded").notNull().default(0), // Cumulative refunded amount in cents
    bonusAmount: integer("bonus_amount").notNull().default(0), // First-purchase bonus granted with this payment, in cents
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    stripeCouponId: varchar("stripe_coupon_id", { length: 255 }),
    stripePromotionCodeId: varchar("stripe_promotion_code_id", { length: 255 }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
    stripeIdempotencyKey: varchar("stripe_idempotency_key", { length: 255 }),
    paymentMethodType: varchar("payment_method_type", { length: 50 }),
    cardBrand: varchar("card_brand", { length: 50 }),
    cardLast4: varchar("card_last4", { length: 4 }),
    receiptUrl: varchar("receipt_url", { length: 2048 }),
    description: varchar("description", { length: 500 }),
    errorMessage: varchar("error_message", { length: 1000 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  table => ({
    // Partial unique index: enforces one transaction row per invoice (manual-credit/coupon paths) and
    // indexes the findByInvoiceId lookup. Exactly-once crediting comes from the locked status check in
    // the webhook; this index just guarantees a single row to credit. payment_intent rows leave it null.
    stripeInvoiceIdUnique: uniqueIndex("stripe_transactions_stripe_invoice_id_unique")
      .on(table.stripeInvoiceId)
      .where(sql`${table.stripeInvoiceId} IS NOT NULL`),
    // Partial unique index: enforces one transaction row per Stripe idempotency key so retried
    // deliveries of the same attempt find-or-create the same row (the PaymentIntent metadata embeds
    // the row id, so a fresh row per delivery would break Stripe's byte-identical replay contract).
    // Keyless payment_intent rows and legacy rows leave it null.
    stripeIdempotencyKeyUnique: uniqueIndex("stripe_transactions_stripe_idempotency_key_unique")
      .on(table.stripeIdempotencyKey)
      .where(sql`${table.stripeIdempotencyKey} IS NOT NULL`),
    userIdIdx: index("stripe_transactions_user_id_idx").on(table.userId),
    stripePaymentIntentIdIdx: index("stripe_transactions_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
    stripeChargeIdIdx: index("stripe_transactions_stripe_charge_id_idx").on(table.stripeChargeId),
    stripeCouponIdIdx: index("stripe_transactions_stripe_coupon_id_idx").on(table.stripeCouponId),
    stripePromotionCodeIdIdx: index("stripe_transactions_stripe_promotion_code_id_idx").on(table.stripePromotionCodeId),
    statusIdx: index("stripe_transactions_status_idx").on(table.status),
    createdAtIdx: index("stripe_transactions_created_at_idx").on(table.createdAt),
    userIdCreatedAtIdx: index("stripe_transactions_user_id_created_at_idx").on(table.userId, table.createdAt)
  })
);

export const StripeTransactionsRelations = relations(StripeTransactions, ({ one }) => ({
  user: one(Users, {
    fields: [StripeTransactions.userId],
    references: [Users.id]
  })
}));
