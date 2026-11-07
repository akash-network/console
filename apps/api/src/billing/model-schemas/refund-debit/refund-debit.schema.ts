import { integer, pgEnum, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { StripeTransactions } from "@src/billing/model-schemas/stripe-transaction/stripe-transaction.schema";

/** A pending debit may already be on chain, so it is never granted again until its outcome is known. */
export const refundDebitStatusEnum = pgEnum("refund_debit_status", ["pending", "landed"]);

/** One row per refund whose debit was granted on chain, kept even when the refund that granted it rolls back. */
export const RefundDebits = pgTable(
  "refund_debits",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => StripeTransactions.id, { onDelete: "cascade" }),
    /** The charge's refunded total in cents once this debit applies, which tells a redelivered refund apart from a later one. */
    amountRefunded: integer("amount_refunded").notNull(),
    status: refundDebitStatusEnum("status").notNull().default("pending"),
    address: varchar("address", { length: 255 }).notNull(),
    /** Cents debited, first-purchase bonus clawback included. */
    amount: integer("amount").notNull(),
    txHash: varchar("tx_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.transactionId, table.amountRefunded] })
  })
);
