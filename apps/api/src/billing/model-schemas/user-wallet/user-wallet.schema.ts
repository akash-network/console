import { boolean, numeric, pgTable, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const UserWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => Users.id)
    .unique(),
  address: varchar("address").unique(),
  stripeCustomerId: varchar("stripe_customer_id"),
  deploymentAllowance: allowance("deployment_allowance"),
  feeAllowance: allowance("fee_allowance"),
  isTrialing: boolean("trial").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

function allowance(name: string) {
  return numeric(name, {
    precision: 20,
    scale: 2
  })
    .notNull()
    .default("0.00");
}
