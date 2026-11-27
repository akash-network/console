import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/** `standby` signs nothing yet, `active` issues new grants, `draining` still backs the grants of wallets not yet moved off it, `retired` backs none. */
export const fundingWalletStatusEnum = pgEnum("funding_wallet_status", ["standby", "active", "draining", "retired"]);

export type FundingWalletStatus = (typeof fundingWalletStatusEnum.enumValues)[number];

/** Keyed by network because mainnet and sandbox share this database while each has funding wallets of its own. */
export const FundingWallets = pgTable(
  "funding_wallets",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    network: varchar("network", { length: 32 }).notNull(),
    address: varchar("address", { length: 128 }).notNull(),
    status: fundingWalletStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    networkAddressUnique: uniqueIndex("funding_wallets_network_address_unique").on(table.network, table.address),
    oneActivePerNetwork: uniqueIndex("funding_wallets_one_active_per_network")
      .on(table.network)
      .where(sql`${table.status} = 'active'`)
  })
);

/** One row per user wallet ever granted on a network; `user_wallet_id` has no foreign key, since assigning every existing user wallet at once would wait on each one another transaction holds locked. */
export const UserWalletGranters = pgTable(
  "user_wallet_granters",
  {
    userWalletId: integer("user_wallet_id").notNull(),
    network: varchar("network", { length: 32 }).notNull(),
    fundingWalletId: uuid("funding_wallet_id")
      .references(() => FundingWallets.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userWalletNetworkPk: primaryKey({ name: "user_wallet_granters_pk", columns: [table.userWalletId, table.network] }),
    fundingWalletIdIdx: index("user_wallet_granters_funding_wallet_id_idx").on(table.fundingWalletId)
  })
);
