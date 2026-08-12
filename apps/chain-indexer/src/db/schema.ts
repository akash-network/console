import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

import { bytea } from "@src/db/bytea";

export const cosmosSchema = pgSchema("cosmos");

export const Blocks = cosmosSchema.table("blocks", {
  height: bigint("height", { mode: "number" }).primaryKey(),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  hash: bytea("hash").notNull(),
  parentHash: bytea("parent_hash"),
  proposerAddress: text("proposer_address").notNull(),
  txCount: integer("tx_count").notNull()
});

export interface FeeCoin {
  denom: string;
  amount: string;
}

export const Transactions = cosmosSchema.table(
  "transactions",
  {
    height: bigint("height", { mode: "number" }).notNull(),
    index: integer("index").notNull(),
    hash: bytea("hash").notNull(),
    code: integer("code").notNull(),
    gasUsed: bigint("gas_used", { mode: "number" }).notNull(),
    gasWanted: bigint("gas_wanted", { mode: "number" }).notNull(),
    fee: jsonb("fee").$type<FeeCoin[]>().notNull()
  },
  t => [primaryKey({ columns: [t.height, t.index] }), index("transactions_hash_idx").on(t.hash)]
);

export const MessageTypes = cosmosSchema.table(
  "message_types",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull()
  },
  t => [uniqueIndex("message_types_type_idx").on(t.type)]
);

export const Messages = cosmosSchema.table(
  "messages",
  {
    height: bigint("height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index").notNull(),
    index: integer("index").notNull(),
    typeId: integer("type_id")
      .notNull()
      .references(() => MessageTypes.id),
    body: jsonb("body")
  },
  t => [primaryKey({ columns: [t.height, t.txIndex, t.index] }), index("messages_type_id_idx").on(t.typeId)]
);

export const IndexerState = pgTable("indexer_state", {
  stream: text("stream").primaryKey(),
  lastHeight: bigint("last_height", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

/**
 * Why an address change happened. Only `genesis` is written today (L-3); the ongoing per-block
 * reasons (transfer/fee/staking/...) land with the balance ledger in L-4. New values are added via
 * migration (Postgres allows ALTER TYPE ... ADD VALUE) rather than editing this list retroactively.
 */
export const balanceChangeReason = cosmosSchema.enum("balance_change_reason", [
  "genesis",
  "transfer",
  "fee",
  "reward",
  "commission",
  "slash",
  "gov",
  "ibc",
  "escrow",
  "bme",
  "mint",
  "burn",
  "staking"
]);

/** Addresses interned once and referenced by integer id, mirroring the message_types lookup. */
export const Accounts = cosmosSchema.table(
  "accounts",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull(),
    accountNumber: bigint("account_number", { mode: "number" }),
    accountType: text("account_type"),
    isModuleAccount: boolean("is_module_account").notNull().default(false)
  },
  t => [uniqueIndex("accounts_address_idx").on(t.address)]
);

/** Current per-denom balance for each account, updated in the same transaction as the ledger. */
export const AccountBalances = cosmosSchema.table(
  "account_balances",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => Accounts.id),
    denom: text("denom").notNull(),
    amount: numeric("amount", { precision: 38, scale: 0 }).notNull()
  },
  t => [primaryKey({ columns: [t.accountId, t.denom] })]
);

/** Append-only ledger of balance changes. `numeric(38,0)` never loses precision on u-denom amounts the way DOUBLE does. */
export const BalanceChanges = cosmosSchema.table(
  "balance_changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => Accounts.id),
    denom: text("denom").notNull(),
    delta: numeric("delta", { precision: 38, scale: 0 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 38, scale: 0 }).notNull(),
    reason: balanceChangeReason("reason").notNull(),
    height: bigint("height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index"),
    eventIndex: integer("event_index").notNull(),
    counterpartyAccountId: integer("counterparty_account_id").references(() => Accounts.id)
  },
  t => [
    index("balance_changes_account_denom_height_idx").on(t.accountId, t.denom, t.height),
    uniqueIndex("balance_changes_height_event_index_idx").on(t.height, t.eventIndex)
  ]
);

export const Validators = cosmosSchema.table("validators", {
  operatorAddress: text("operator_address").primaryKey(),
  accountAddress: text("account_address"),
  hexAddress: text("hex_address"),
  moniker: text("moniker"),
  identity: text("identity"),
  website: text("website"),
  details: text("details"),
  securityContact: text("security_contact"),
  commissionRate: numeric("commission_rate", { precision: 20, scale: 18 }),
  commissionMaxRate: numeric("commission_max_rate", { precision: 20, scale: 18 }),
  commissionMaxChangeRate: numeric("commission_max_change_rate", { precision: 20, scale: 18 }),
  minSelfDelegation: numeric("min_self_delegation", { precision: 38, scale: 0 })
});

export const Delegations = cosmosSchema.table(
  "delegations",
  {
    delegatorAccountId: integer("delegator_account_id")
      .notNull()
      .references(() => Accounts.id),
    validatorOperatorAddress: text("validator_operator_address").notNull(),
    shares: numeric("shares", { precision: 38, scale: 18 }).notNull()
  },
  t => [primaryKey({ columns: [t.delegatorAccountId, t.validatorOperatorAddress] })]
);

/** How an address participated in a transaction: it signed it, or it was the sender/recipient of a coin movement. */
export const accountTxRole = cosmosSchema.enum("account_tx_role", ["signer", "sender", "receiver"]);

/**
 * Address activity log: one row per (address, tx, role). The leading `(accountId, height)` of the primary
 * key serves "list an address's activity newest-first"; the composite key makes re-committing a block idempotent.
 */
export const AccountTxs = cosmosSchema.table(
  "account_txs",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => Accounts.id),
    height: bigint("height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index").notNull(),
    role: accountTxRole("role").notNull()
  },
  t => [primaryKey({ columns: [t.accountId, t.height, t.txIndex, t.role] })]
);
