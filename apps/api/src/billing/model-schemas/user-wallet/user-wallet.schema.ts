import { boolean, pgTable, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas"; // eslint-disable-line import-x/no-cycle

export const UserWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  address: varchar("address").unique(),
  isTrialing: boolean("trial").default(true).notNull(),
  isOldWallet: boolean("is_old_wallet").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
