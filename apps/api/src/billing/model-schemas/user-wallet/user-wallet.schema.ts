import { numeric, pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const userWalletSchema = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  address: varchar("address"),
  stripeCustomerId: varchar("stripe_customer_id"),
  creditAmount: numeric("credit_amount", {
    precision: 10,
    scale: 2
  })
    .notNull()
    .default("0.00")
});
