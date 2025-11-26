import { sql } from "drizzle-orm";
import { boolean, index, integer, numeric, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
    autoReloadThreshold: numeric("auto_reload_threshold", {
      precision: 20,
      scale: 2
    }),
    autoReloadAmount: numeric("auto_reload_amount", {
      precision: 20,
      scale: 2
    }),
    autoReloadJobId: uuid("auto_reload_job_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  table => ({
    walletIdUnique: unique("wallet_settings_wallet_id_unique").on(table.walletId),
    userIdIdx: index("wallet_settings_user_id_idx").on(table.userId)
  })
);
