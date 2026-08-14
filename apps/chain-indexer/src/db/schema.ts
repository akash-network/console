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

/**
 * Messages whose body failed to decode keep their raw bytes and error here, so registering the
 * type later and replaying the range can heal the null body. Re-committing a height clears its
 * rows first, so a clean replay leaves no stale dead letters behind.
 */
export const MessageDeadLetters = cosmosSchema.table(
  "message_dead_letters",
  {
    height: bigint("height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index").notNull(),
    index: integer("index").notNull(),
    typeId: integer("type_id")
      .notNull()
      .references(() => MessageTypes.id),
    raw: bytea("raw").notNull(),
    error: text("error").notNull()
  },
  t => [primaryKey({ columns: [t.height, t.txIndex, t.index] }), index("message_dead_letters_type_id_idx").on(t.typeId)]
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

/** Consensus bond status, mirroring cosmos `BondStatus` minus the never-valid `UNSPECIFIED`. Written by the staking snapshot. */
export const validatorStatus = cosmosSchema.enum("validator_status", ["unbonded", "unbonding", "bonded"]);

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
  minSelfDelegation: numeric("min_self_delegation", { precision: 38, scale: 0 }),
  /** Bond status, self-bonded stake and shares come from the staking snapshot, not from messages, so genesis-seeded rows carry them as null until the first snapshot. */
  jailed: boolean("jailed").notNull().default(false),
  status: validatorStatus("status"),
  tokens: numeric("tokens", { precision: 38, scale: 0 }),
  delegatorShares: numeric("delegator_shares", { precision: 38, scale: 18 }),
  unbondingHeight: bigint("unbonding_height", { mode: "number" }),
  unbondingTime: timestamp("unbonding_time", { withTimezone: true })
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

/**
 * In-flight undelegations, one row per unbonding entry. `creationHeight` distinguishes a delegator's
 * concurrent entries against the same validator, so it completes the primary key. Fully replaced from the
 * staking snapshot rather than tracked incrementally, since an entry disappears silently once it matures.
 */
export const UnbondingDelegations = cosmosSchema.table(
  "unbonding_delegations",
  {
    delegatorAccountId: integer("delegator_account_id")
      .notNull()
      .references(() => Accounts.id),
    validatorOperatorAddress: text("validator_operator_address").notNull(),
    creationHeight: bigint("creation_height", { mode: "number" }).notNull(),
    completionTime: timestamp("completion_time", { withTimezone: true }).notNull(),
    initialBalance: numeric("initial_balance", { precision: 38, scale: 0 }).notNull(),
    balance: numeric("balance", { precision: 38, scale: 0 }).notNull()
  },
  t => [primaryKey({ columns: [t.delegatorAccountId, t.validatorOperatorAddress, t.creationHeight] })]
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

/** Proposal lifecycle. `deposit_period` on submission; the EndBlock gov events drive the terminal states. */
export const proposalStatus = cosmosSchema.enum("proposal_status", ["deposit_period", "voting_period", "passed", "rejected", "failed"]);

export const voteOption = cosmosSchema.enum("vote_option", ["yes", "abstain", "no", "no_with_veto"]);

/** One weighted vote option, matching cosmos `WeightedVoteOption` (a plain `MsgVote` is stored as a single weight-1 option). */
export interface WeightedVoteOption {
  option: (typeof voteOption.enumValues)[number];
  weight: string;
}

/**
 * Governance proposals, keyed by their on-chain id (assigned in the `submit_proposal` event, not the message).
 * `title`/`summary` are populated for gov v1 proposals; a v1beta1 proposal keeps its legacy content under
 * `messages`. Final tally is left null for a later reconcile — the power-weighted result isn't in the events.
 */
export const Proposals = cosmosSchema.table("proposals", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  proposerAccountId: integer("proposer_account_id").references(() => Accounts.id),
  title: text("title"),
  summary: text("summary"),
  messages: jsonb("messages"),
  metadata: text("metadata"),
  status: proposalStatus("status").notNull(),
  submitTime: timestamp("submit_time", { withTimezone: true }),
  depositEndTime: timestamp("deposit_end_time", { withTimezone: true }),
  votingStartTime: timestamp("voting_start_time", { withTimezone: true }),
  votingEndTime: timestamp("voting_end_time", { withTimezone: true }),
  totalDeposit: jsonb("total_deposit").$type<FeeCoin[]>(),
  finalTallyYes: numeric("final_tally_yes", { precision: 38, scale: 0 }),
  finalTallyAbstain: numeric("final_tally_abstain", { precision: 38, scale: 0 }),
  finalTallyNo: numeric("final_tally_no", { precision: 38, scale: 0 }),
  finalTallyNoWithVeto: numeric("final_tally_no_with_veto", { precision: 38, scale: 0 }),
  submitHeight: bigint("submit_height", { mode: "number" }).notNull()
});

/** Latest vote per (proposal, voter) — a re-vote overwrites the prior one, mirroring chain state. */
export const ProposalVotes = cosmosSchema.table(
  "proposal_votes",
  {
    proposalId: bigint("proposal_id", { mode: "number" }).notNull(),
    voterAccountId: integer("voter_account_id")
      .notNull()
      .references(() => Accounts.id),
    options: jsonb("options").$type<WeightedVoteOption[]>().notNull(),
    height: bigint("height", { mode: "number" }).notNull()
  },
  t => [primaryKey({ columns: [t.proposalId, t.voterAccountId] })]
);

/** One row per depositor per block — same-block deposits are summed by the deriver, so re-committing a block is idempotent and no deposit is lost. `Proposals.total_deposit` is the sum of these rows. */
export const ProposalDeposits = cosmosSchema.table(
  "proposal_deposits",
  {
    proposalId: bigint("proposal_id", { mode: "number" }).notNull(),
    depositorAccountId: integer("depositor_account_id")
      .notNull()
      .references(() => Accounts.id),
    amount: jsonb("amount").$type<FeeCoin[]>().notNull(),
    height: bigint("height", { mode: "number" }).notNull()
  },
  t => [primaryKey({ columns: [t.proposalId, t.depositorAccountId, t.height] })]
);
