import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const x402TransactionStatusEnum = pgEnum("x402_transaction_status", [
  "pending",
  // Payment settled on-chain but wallet credit not yet applied (crash-recovery window)
  "settled",
  "succeeded",
  "failed"
]);

export const X402Transactions = pgTable(
  "x402_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    status: x402TransactionStatusEnum("status").notNull().default("pending"),
    amount: integer("amount").notNull(), // Amount in cents
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    network: varchar("network", { length: 100 }).notNull(), // CAIP-2 network id, e.g. eip155:8453
    asset: varchar("asset", { length: 255 }).notNull(), // Settlement asset address, e.g. USDC contract
    // SHA-256 of the signed payment payload — makes crediting idempotent per payment
    paymentHash: varchar("payment_hash", { length: 64 }).notNull(),
    payerAddress: varchar("payer_address", { length: 255 }),
    settlementTxHash: varchar("settlement_tx_hash", { length: 255 }),
    errorMessage: varchar("error_message", { length: 1000 }),
    // Dseq of the deployment funded by this payment (pay-per-deploy flow). Null for plain top-ups.
    deploymentDseq: varchar("deployment_dseq", { length: 100 }),
    // True when the payment settled and credited but the subsequent deployment creation failed.
    // Funds remain in the user's Console balance; no on-chain reversal is ever attempted.
    deployFailed: boolean("deploy_failed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  table => ({
    paymentHashUnique: uniqueIndex("x402_transactions_payment_hash_unique").on(table.paymentHash),
    userIdIdx: index("x402_transactions_user_id_idx").on(table.userId),
    statusIdx: index("x402_transactions_status_idx").on(table.status),
    userIdCreatedAtIdx: index("x402_transactions_user_id_created_at_idx").on(table.userId, table.createdAt)
  })
);

export const X402TransactionsRelations = relations(X402Transactions, ({ one }) => ({
  user: one(Users, {
    fields: [X402Transactions.userId],
    references: [Users.id]
  })
}));
