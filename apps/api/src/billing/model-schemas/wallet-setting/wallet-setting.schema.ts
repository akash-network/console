import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { UserWallets } from "@src/billing/model-schemas/user-wallet/user-wallet.schema";
import { Users } from "@src/user/model-schemas";

export const autoReloadModeEnum = pgEnum("auto_reload_mode", ["prediction", "threshold"]);

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
    /**
     * Defaults to the predicted-spend rule so rows that predate this column keep the behavior their owner
     * signed up for. The product default for a new enablement is "threshold" and is sent explicitly by the
     * client, never inferred here.
     */
    autoReloadMode: autoReloadModeEnum("auto_reload_mode").notNull().default("prediction"),
    autoReloadThreshold: integer("auto_reload_threshold").notNull().default(2000),
    autoReloadAmount: integer("auto_reload_amount").notNull().default(10000),
    /**
     * Claim marker rate-limiting automatic charges in both modes: set by the winning claim right
     * before the card is charged, and kept whether the charge succeeds or fails. Null means the
     * wallet has never been auto-charged, or that a payment method change cleared the marker.
     */
    lastAutoChargeAt: timestamp("last_auto_charge_at"),
    autoReloadFailureCount: integer("auto_reload_failure_count").notNull().default(0),
    /** Set once a card has declined too many times in a row, and cleared when the user changes their payment method. */
    autoReloadPausedAt: timestamp("auto_reload_paused_at", { withTimezone: true }),
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
