import { relations, sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const StripeTransactions = pgTable("stripe_transactions", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  stripeTransactionId: varchar("stripe_transaction_id", { length: 255 }).unique().notNull(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
  amount: text("amount").notNull(), // Store as string to preserve precision
  currency: varchar("currency", { length: 10 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  metadata: jsonb("metadata"),
  stripeCreatedAt: timestamp("stripe_created_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const StripeTransactionsRelations = relations(StripeTransactions, ({ one }) => ({
  user: one(Users, {
    fields: [StripeTransactions.userId],
    references: [Users.id]
  })
}));

export type StripeTransaction = typeof StripeTransactions.$inferSelect;
export type NewStripeTransaction = typeof StripeTransactions.$inferInsert;
