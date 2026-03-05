import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { UserWallets } from "@src/billing/model-schemas/user-wallet/user-wallet.schema";
import { Users } from "@src/user/model-schemas";

export const WalletSetting = pgTable(
  "wallet_settings",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    walletId: integer("wallet_id")
      .references(() => UserWallets.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    autoReloadEnabled: boolean("auto_reload_enabled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  table => ({
    walletIdUnique: unique("wallet_settings_wallet_id_unique").on(table.walletId),
    userIdIdx: index("wallet_settings_user_id_idx").on(table.userId)
  })
);

export const WalletSettingRelations = relations(WalletSetting, ({ one }) => ({
  user: one(Users, {
    fields: [WalletSetting.userId],
    references: [Users.id]
  }),
  wallet: one(UserWallets, {
    fields: [WalletSetting.walletId],
    references: [UserWallets.id]
  })
}));
