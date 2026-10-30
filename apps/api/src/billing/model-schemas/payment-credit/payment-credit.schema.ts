import { integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { StripeTransactions } from "@src/billing/model-schemas/stripe-transaction/stripe-transaction.schema";

/** A pending credit may already be on chain, so it is never granted again until its outcome is known. */
export const paymentCreditStatusEnum = pgEnum("payment_credit_status", ["pending", "landed"]);

export type PaymentCreditStatus = (typeof paymentCreditStatusEnum.enumValues)[number];

/** One row per settled payment whose credit was granted on chain, kept even when the settlement that granted it rolls back. */
export const PaymentCredits = pgTable("payment_credits", {
  transactionId: uuid("transaction_id")
    .primaryKey()
    .references(() => StripeTransactions.id, { onDelete: "cascade" }),
  status: paymentCreditStatusEnum("status").notNull().default("pending"),
  address: varchar("address", { length: 255 }).notNull(),
  /** Cents credited, first-purchase bonus included. */
  amount: integer("amount").notNull(),
  txHash: varchar("tx_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
