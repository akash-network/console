import { boolean, numeric, pgTable, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas"; // eslint-disable-line import-x/no-cycle

export const UserWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  address: varchar("address").unique(),
  deploymentAllowance: allowance("deployment_allowance"),
  feeAllowance: allowance("fee_allowance"),
  isTrialing: boolean("trial").default(true),
  reviewStatus: varchar("review_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

function allowance(name: string) {
  return numeric(name, {
    precision: 20,
    scale: 2
  })
    .notNull()
    .default("0.00");
}
