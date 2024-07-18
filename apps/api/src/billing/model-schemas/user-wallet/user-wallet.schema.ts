import { numeric, pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const userWalletSchema = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  address: varchar("address"),
  stripeCustomerId: varchar("stripe_customer_id"),
  deploymentAllowance: allowance("deployment_allowance"),
  feeAllowance: allowance("fee_allowance")
});

function allowance(name: string) {
  return numeric(name, {
    precision: 10,
    scale: 2
  })
    .notNull()
    .default("0.00");
}
