import { relations, sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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

export const stripeTransactionTypeEnum = pgEnum("stripe_transaction_type", ["payment_intent"]);

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
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
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
    userIdIdx: index("stripe_transactions_user_id_idx").on(table.userId),
    stripePaymentIntentIdIdx: index("stripe_transactions_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
    stripeChargeIdIdx: index("stripe_transactions_stripe_charge_id_idx").on(table.stripeChargeId),
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
