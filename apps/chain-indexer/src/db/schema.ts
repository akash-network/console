import { sql } from "drizzle-orm";
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

import type { ProviderAttribute } from "@src/akash/akash-changes";
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
 * rows first, and a new dead-letter row is only inserted when the matching message body is still
 * null, so a clean replay (or a later writer that already decoded the message) leaves no stale
 * rows behind.
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

export const akashSchema = pgSchema("akash");

export const deploymentCloseReason = akashSchema.enum("deployment_close_reason", ["close_message", "overdrawn", "close_event"]);

export const groupState = akashSchema.enum("group_state", ["open", "paused", "closed"]);

/** `active` means the bid was accepted and became a lease; bids are kept on close (unlike the legacy indexer) so the deployment timeline can tell winning bids from losing ones. */
export const bidState = akashSchema.enum("bid_state", ["open", "active", "closed"]);

export const deploymentEventType = akashSchema.enum("deployment_event_type", [
  "created",
  "deposited",
  "updated",
  "closed",
  "group_closed",
  "group_paused",
  "group_started",
  "bid_created",
  "bid_closed",
  "lease_created",
  "lease_closed",
  "lease_withdrawn"
]);

/**
 * Deployments carry denormalized resource totals (the sum over group resources of quantity × count)
 * and the escrow account state, so list endpoints read one row instead of joining three levels deep.
 * `balance`/`withdrawn_amount` are 18-decimal Dec values mirroring the on-chain escrow account;
 * `last_withdraw_height` is the on-chain settlement checkpoint. `last_processed_height` is the
 * indexer's replay watermark: blocks at or below it are duplicates and must not be re-applied, which
 * — like the balance ledger — makes correctness depend on indexing a deployment's messages in height
 * order from its creation (backfill from genesis, then sync).
 */
export const Deployments = akashSchema.table(
  "deployments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerAccountId: integer("owner_account_id")
      .notNull()
      .references(() => Accounts.id),
    dseq: numeric("dseq", { precision: 20, scale: 0 }).notNull(),
    denom: text("denom").notNull(),
    deposit: numeric("deposit", { precision: 38, scale: 0 }).notNull(),
    balance: numeric("balance", { precision: 38, scale: 18 }).notNull(),
    withdrawnAmount: numeric("withdrawn_amount", { precision: 38, scale: 18 }).notNull(),
    blockRate: numeric("block_rate", { precision: 38, scale: 18 }).notNull().default("0"),
    lastWithdrawHeight: bigint("last_withdraw_height", { mode: "number" }),
    lastProcessedHeight: bigint("last_processed_height", { mode: "number" }).notNull(),
    createdHeight: bigint("created_height", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    closedHeight: bigint("closed_height", { mode: "number" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closeReason: deploymentCloseReason("close_reason"),
    cpuUnits: bigint("cpu_units", { mode: "number" }).notNull(),
    gpuUnits: bigint("gpu_units", { mode: "number" }).notNull(),
    memoryBytes: bigint("memory_bytes", { mode: "number" }).notNull(),
    ephemeralStorageBytes: bigint("ephemeral_storage_bytes", { mode: "number" }).notNull(),
    persistentStorageBytes: bigint("persistent_storage_bytes", { mode: "number" }).notNull()
  },
  t => [
    uniqueIndex("deployments_owner_dseq_idx").on(t.ownerAccountId, t.dseq),
    index("deployments_owner_created_idx").on(t.ownerAccountId, t.createdHeight),
    index("deployments_open_idx")
      .on(t.createdHeight)
      .where(sql`${t.closedHeight} IS NULL`)
  ]
);

export const DeploymentGroups = akashSchema.table(
  "deployment_groups",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    deploymentId: bigint("deployment_id", { mode: "number" })
      .notNull()
      .references(() => Deployments.id),
    gseq: integer("gseq").notNull(),
    state: groupState("state").notNull().default("open"),
    closedHeight: bigint("closed_height", { mode: "number" })
  },
  t => [uniqueIndex("deployment_groups_deployment_gseq_idx").on(t.deploymentId, t.gseq)]
);

/** Immutable spec rows; `idx` is the resource's position in the on-chain GroupSpec resources array. */
export const DeploymentGroupResources = akashSchema.table(
  "deployment_group_resources",
  {
    deploymentGroupId: bigint("deployment_group_id", { mode: "number" })
      .notNull()
      .references(() => DeploymentGroups.id),
    idx: integer("idx").notNull(),
    count: integer("count").notNull(),
    cpuUnits: bigint("cpu_units", { mode: "number" }).notNull(),
    gpuUnits: bigint("gpu_units", { mode: "number" }).notNull(),
    gpuVendor: text("gpu_vendor"),
    gpuModel: text("gpu_model"),
    memoryBytes: bigint("memory_bytes", { mode: "number" }).notNull(),
    ephemeralStorageBytes: bigint("ephemeral_storage_bytes", { mode: "number" }).notNull(),
    persistentStorageBytes: bigint("persistent_storage_bytes", { mode: "number" }).notNull(),
    price: numeric("price", { precision: 38, scale: 18 }).notNull(),
    priceDenom: text("price_denom").notNull()
  },
  t => [primaryKey({ columns: [t.deploymentGroupId, t.idx] })]
);

export const Bids = akashSchema.table(
  "bids",
  {
    deploymentId: bigint("deployment_id", { mode: "number" })
      .notNull()
      .references(() => Deployments.id),
    gseq: integer("gseq").notNull(),
    oseq: integer("oseq").notNull(),
    bseq: integer("bseq").notNull().default(0),
    providerAccountId: integer("provider_account_id")
      .notNull()
      .references(() => Accounts.id),
    price: numeric("price", { precision: 38, scale: 18 }).notNull(),
    denom: text("denom").notNull(),
    state: bidState("state").notNull().default("open"),
    createdHeight: bigint("created_height", { mode: "number" }).notNull(),
    closedHeight: bigint("closed_height", { mode: "number" })
  },
  t => [primaryKey({ columns: [t.deploymentId, t.gseq, t.oseq, t.bseq, t.providerAccountId] })]
);

/**
 * Leases carry the same denormalized resource totals as deployments (their group's quantity × count sums)
 * so the per-block active-resource aggregation never joins group resources. `balance` is the accrued-but-
 * unwithdrawn earnings mirroring the on-chain payment balance (payouts truncate to whole units and the
 * fraction is refunded to the deployment on close); `predicted_closed_height` is the height at which the
 * escrow balance runs out at the current block rate, recomputed on every balance- or rate-changing
 * message, mirroring the legacy indexer's formulas.
 */
export const Leases = akashSchema.table(
  "leases",
  {
    deploymentId: bigint("deployment_id", { mode: "number" })
      .notNull()
      .references(() => Deployments.id),
    deploymentGroupId: bigint("deployment_group_id", { mode: "number" })
      .notNull()
      .references(() => DeploymentGroups.id),
    gseq: integer("gseq").notNull(),
    oseq: integer("oseq").notNull(),
    bseq: integer("bseq").notNull().default(0),
    providerAccountId: integer("provider_account_id")
      .notNull()
      .references(() => Accounts.id),
    price: numeric("price", { precision: 38, scale: 18 }).notNull(),
    denom: text("denom").notNull(),
    balance: numeric("balance", { precision: 38, scale: 18 }).notNull().default("0"),
    withdrawnAmount: numeric("withdrawn_amount", { precision: 38, scale: 18 }).notNull().default("0"),
    predictedClosedHeight: numeric("predicted_closed_height", { precision: 30, scale: 0 }).notNull(),
    createdHeight: bigint("created_height", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    closedHeight: bigint("closed_height", { mode: "number" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    cpuUnits: bigint("cpu_units", { mode: "number" }).notNull(),
    gpuUnits: bigint("gpu_units", { mode: "number" }).notNull(),
    memoryBytes: bigint("memory_bytes", { mode: "number" }).notNull(),
    ephemeralStorageBytes: bigint("ephemeral_storage_bytes", { mode: "number" }).notNull(),
    persistentStorageBytes: bigint("persistent_storage_bytes", { mode: "number" }).notNull()
  },
  t => [
    primaryKey({ columns: [t.deploymentId, t.gseq, t.oseq, t.bseq, t.providerAccountId] }),
    index("leases_provider_idx").on(t.providerAccountId, t.closedHeight, t.createdHeight),
    index("leases_open_idx")
      .on(t.deploymentId)
      .where(sql`${t.closedHeight} IS NULL`)
  ]
);

/**
 * Typed per-deployment timeline replacing the legacy relatedMessages join. Every lifecycle change is
 * stored, including withdrawals and losing bids — the legacy history view is a read-side filter, not a
 * write-side decision. `ordinal` is the deterministic position of the deployment's events within the
 * block, so re-committing a block conflicts instead of duplicating. `tx_index`/`msg_index` are null for
 * events derived outside a message (e.g. close-event fallbacks); the tx hash comes from joining
 * `cosmos.transactions`.
 */
export const DeploymentEvents = akashSchema.table(
  "deployment_events",
  {
    deploymentId: bigint("deployment_id", { mode: "number" })
      .notNull()
      .references(() => Deployments.id),
    height: bigint("height", { mode: "number" }).notNull(),
    ordinal: integer("ordinal").notNull(),
    txIndex: integer("tx_index"),
    msgIndex: integer("msg_index"),
    type: deploymentEventType("type").notNull(),
    details: jsonb("details")
  },
  t => [primaryKey({ columns: [t.deploymentId, t.height, t.ordinal] })]
);

/**
 * Current on-chain provider state, one row per owner — mirroring `akash query provider list`.
 * A provider that deletes and re-registers reuses its row: create resets `created_height` and
 * clears `updated_height`/`deleted_height`, so the original registration height is not kept.
 * Attributes are the full replace-on-update set from MsgCreate/MsgUpdateProvider.
 * `last_processed_height` is the replay watermark (same semantics as deployments).
 */
export const Providers = akashSchema.table("providers", {
  ownerAccountId: integer("owner_account_id")
    .primaryKey()
    .references(() => Accounts.id),
  hostUri: text("host_uri").notNull(),
  email: text("email"),
  website: text("website"),
  attributes: jsonb("attributes").$type<ProviderAttribute[]>().notNull(),
  lastProcessedHeight: bigint("last_processed_height", { mode: "number" }).notNull(),
  createdHeight: bigint("created_height", { mode: "number" }).notNull(),
  updatedHeight: bigint("updated_height", { mode: "number" }),
  deletedHeight: bigint("deleted_height", { mode: "number" })
});

/**
 * Audited provider attributes, one row per (owner, auditor, key) — mirroring the x/audit store.
 * Keyed by account rather than the providers row because x/audit never consults x/provider:
 * signatures survive provider deletion and can precede registration. MsgSignProviderAttributes
 * merges per-key; MsgDeleteProviderAttributes deletes the given keys, or all of the auditor's
 * keys when none are given. `height` is the per-row replay guard: signs only apply at or above
 * it and deletes only remove rows written at or below the deleting block.
 */
export const ProviderAuditSignatures = akashSchema.table(
  "provider_audit_signatures",
  {
    ownerAccountId: integer("owner_account_id")
      .notNull()
      .references(() => Accounts.id),
    auditorAccountId: integer("auditor_account_id")
      .notNull()
      .references(() => Accounts.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
    height: bigint("height", { mode: "number" }).notNull()
  },
  t => [primaryKey({ columns: [t.ownerAccountId, t.auditorAccountId, t.key] })]
);
