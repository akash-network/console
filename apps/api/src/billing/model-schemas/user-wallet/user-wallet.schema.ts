import { boolean, numeric, pgTable, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { MasterWallets } from "@src/billing/model-schemas/master-wallet/master-wallet.schema";
import { Users } from "@src/user/model-schemas"; // eslint-disable-line import-x/no-cycle

export const UserWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .unique(),
  address: varchar("address").unique(),
  deploymentAllowance: allowance("deployment_allowance"),
  feeAllowance: allowance("fee_allowance"),
  isTrialing: boolean("trial").default(true),
  derivedFromMasterWalletId: serial("derived_from_master_wallet_id").references(() => MasterWallets.id),
  authzFromMasterWalletId: serial("authz_from_master_wallet_id").references(() => MasterWallets.id),
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
