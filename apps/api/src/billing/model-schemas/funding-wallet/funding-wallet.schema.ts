import { sql } from "drizzle-orm";
import { bigint, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

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

/** `revoking` until the old wallet's grants are known to be gone, `revoked` until the credit is sent, `crediting` while a credit may already be on chain, `failed` when a person has to finish the move. */
export const fundingWalletMoveStatusEnum = pgEnum("funding_wallet_move_status", ["revoking", "revoked", "crediting", "completed", "failed"]);

export type FundingWalletMoveStatus = (typeof fundingWalletMoveStatusEnum.enumValues)[number];

/** One row per user wallet moved off a funding wallet, written before anything is revoked so the balance being moved survives a crash. */
export const FundingWalletMoves = pgTable(
  "funding_wallet_moves",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userWalletId: integer("user_wallet_id").notNull(),
    network: varchar("network", { length: 32 }).notNull(),
    fromFundingWalletId: uuid("from_funding_wallet_id")
      .references(() => FundingWallets.id)
      .notNull(),
    toFundingWalletId: uuid("to_funding_wallet_id")
      .references(() => FundingWallets.id)
      .notNull(),
    status: fundingWalletMoveStatusEnum("status").notNull(),
    /** The deployment allowance read on the old wallet's grant, in the grant's smallest unit. */
    readLimit: bigint("read_limit", { mode: "number" }).notNull(),
    /** What lands on the old grant after this height and before its revoke is what the read missed. */
    readHeight: bigint("read_height", { mode: "number" }).notNull(),
    /** The fee allowance left on the old wallet, in uakt, granted again as it was so a trial keeps the expiry it had. */
    feeLimit: bigint("fee_limit", { mode: "number" }).notNull(),
    feeExpiresAt: timestamp("fee_expires_at", { withTimezone: true }),
    revokeSentAt: timestamp("revoke_sent_at", { withTimezone: true }),
    revokeTxHash: varchar("revoke_tx_hash", { length: 64 }),
    failure: text("failure"),
    claimedUntil: timestamp("claimed_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    oneMovePerSourceWallet: uniqueIndex("funding_wallet_moves_user_wallet_source_unique").on(table.userWalletId, table.network, table.fromFundingWalletId),
    sourceStatusIdx: index("funding_wallet_moves_source_status_idx").on(table.fromFundingWalletId, table.status)
  })
);
