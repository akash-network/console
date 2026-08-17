import type { AkashBlockChanges, AkashChange, DeploymentKey, LeaseSlot, NormalizedGroup, NormalizedResource } from "@src/akash/akash-changes";
import { isProviderChange } from "@src/akash/akash-changes";
import { decCeilInt, decFromInt, decFromString, decQuo, decToString, decTruncateInt } from "@src/akash/dec";
import { normalizeDenom } from "@src/akash/denom";
import { settle, sumLeaseRate } from "@src/akash/settlement";
import type { bidState, deploymentCloseReason, deploymentEventType, groupState } from "@src/db/schema";

export type DeploymentCloseReason = (typeof deploymentCloseReason.enumValues)[number];
export type DeploymentEventType = (typeof deploymentEventType.enumValues)[number];
export type GroupStateValue = (typeof groupState.enumValues)[number];
export type BidStateValue = (typeof bidState.enumValues)[number];

export interface ResourceTotals {
  cpuUnits: number;
  gpuUnits: number;
  memoryBytes: number;
  ephemeralStorageBytes: number;
  persistentStorageBytes: number;
}

export interface GroupAggState {
  gseq: number;
  state: GroupStateValue;
  closedHeight: number | null;
  resources: NormalizedResource[];
}

export interface BidAggState {
  gseq: number;
  oseq: number;
  bseq: number;
  provider: string;
  price: bigint;
  denom: string;
  state: BidStateValue;
  createdHeight: number;
  closedHeight: number | null;
}

export interface LeaseAggState extends ResourceTotals {
  gseq: number;
  oseq: number;
  bseq: number;
  provider: string;
  price: bigint;
  denom: string;
  /** Accrued-but-unwithdrawn earnings, mirroring the on-chain payment balance. */
  balance: bigint;
  /** Paid-out total; the chain truncates every payout to whole units, so this is always integral. */
  withdrawn: bigint;
  predictedClosedHeight: bigint;
  createdHeight: number;
  createdAt: Date;
  closedHeight: number | null;
  closedAt: Date | null;
}

export interface DeploymentEventDraft {
  height: number;
  ordinal: number;
  txIndex: number | null;
  msgIndex: number | null;
  type: DeploymentEventType;
  details: Record<string, unknown> | null;
}

export interface DeploymentAggState extends ResourceTotals {
  key: DeploymentKey;
  denom: string;
  deposit: bigint;
  balance: bigint;
  withdrawn: bigint;
  lastWithdrawHeight: number | null;
  lastProcessedHeight: number;
  createdHeight: number;
  createdAt: Date;
  closedHeight: number | null;
  closedAt: Date | null;
  closeReason: DeploymentCloseReason | null;
  groups: GroupAggState[];
  bids: BidAggState[];
  leases: LeaseAggState[];
  events: DeploymentEventDraft[];
  isNew: boolean;
  touched: boolean;
}

export interface ReducerWarning {
  code: "AKASH_ORPHAN_REFERENCE" | "AKASH_UNKNOWN_DENOM";
  kind: AkashChange["kind"];
  owner: string;
  dseq: string;
  height: number;
}

export function stateKey(key: DeploymentKey): string {
  return `${key.owner}/${key.dseq}`;
}

/**
 * Applies one block's derived changes to the in-memory deployment states, porting the legacy
 * indexer's handler semantics onto the current keeper's exact escrow math. Blocks must be applied in
 * ascending height order. A block at or below a deployment's `lastProcessedHeight` watermark is a
 * duplicate commit (replay or an overlapping writer) and is skipped for that deployment, which keeps
 * the read-modify-write escrow state idempotent; both runners commit strictly in order, so an
 * older-than-watermark block can never carry unseen changes.
 */
export function applyBlockChanges(states: Map<string, DeploymentAggState>, block: AkashBlockChanges): ReducerWarning[] {
  const warnings: ReducerWarning[] = [];
  const decided = new Map<string, boolean>();

  for (const change of block.changes) {
    if (isProviderChange(change)) {
      continue;
    }
    const key = stateKey(change.key);

    if (change.kind === "deploymentCreated") {
      if (shouldApply(decided, states.get(key), block.height, key)) {
        createDeployment(states, change, block, warnings);
      }
      continue;
    }

    const state = states.get(key);
    if (!state) {
      warnings.push({ code: "AKASH_ORPHAN_REFERENCE", kind: change.kind, owner: change.key.owner, dseq: change.key.dseq, height: block.height });
      continue;
    }
    if (!shouldApply(decided, state, block.height, key)) {
      continue;
    }

    applyChange(state, change, block, warnings);
  }

  for (const [key, applied] of decided) {
    const state = states.get(key);
    if (state && applied) {
      state.lastProcessedHeight = block.height;
      state.touched = true;
    }
  }

  return warnings;
}

/** The skip decision is made once per deployment per block, so a deployment created earlier in the same block still receives its later changes. */
function shouldApply(decided: Map<string, boolean>, state: DeploymentAggState | undefined, height: number, key: string): boolean {
  const existing = decided.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const applies = !state || height > state.lastProcessedHeight;
  decided.set(key, applies);
  return applies;
}

function applyChange(state: DeploymentAggState, change: AkashChange, block: AkashBlockChanges, warnings: ReducerWarning[]): void {
  switch (change.kind) {
    case "deploymentDeposited":
      return applyDeposit(state, change, block);
    case "deploymentUpdated":
      return addEvent(state, block, change, "updated", null);
    case "deploymentClosed":
      return applyDeploymentClose(state, change, block, "close_message");
    case "deploymentClosedEvent":
      return applyDeploymentCloseEvent(state, change, block);
    case "groupClosed":
      return applyGroupChange(state, change, block, "closed", "group_closed");
    case "groupPaused":
      return applyGroupChange(state, change, block, "paused", "group_paused");
    case "groupStarted":
      return applyGroupChange(state, change, block, "open", "group_started");
    case "bidCreated":
      return applyBidCreated(state, change, block);
    case "bidClosed":
      return applyBidClosed(state, change, block);
    case "leaseCreated":
      return applyLeaseCreated(state, change, block, warnings);
    case "leaseClosed":
      return applyLeaseClosed(state, change, block);
    case "leaseWithdrawn":
      return applyLeaseWithdrawn(state, change, block, warnings);
    case "leaseClosedEvent":
      return applyLeaseClosedEvent(state, change, block);
  }
}

function createDeployment(
  states: Map<string, DeploymentAggState>,
  change: Extract<AkashChange, { kind: "deploymentCreated" }>,
  block: AkashBlockChanges,
  warnings: ReducerWarning[]
): void {
  const { denom, known } = normalizeDenom(change.denom);
  if (!known) {
    warnings.push({ code: "AKASH_UNKNOWN_DENOM", kind: change.kind, owner: change.key.owner, dseq: change.key.dseq, height: block.height });
  }

  const state: DeploymentAggState = {
    key: change.key,
    denom,
    deposit: BigInt(change.deposit),
    balance: decFromString(change.deposit),
    withdrawn: 0n,
    lastWithdrawHeight: null,
    lastProcessedHeight: 0,
    createdHeight: block.height,
    createdAt: block.datetime,
    closedHeight: null,
    closedAt: null,
    closeReason: null,
    ...sumGroupTotals(change.groups),
    groups: change.groups.map(group => ({ gseq: group.gseq, state: "open", closedHeight: null, resources: group.resources })),
    bids: [],
    leases: [],
    events: [],
    isNew: true,
    touched: true
  };

  states.set(stateKey(change.key), state);
  addEvent(state, block, change, "created", { deposit: change.deposit, denom, ...(change.depositor ? { depositor: change.depositor } : {}) });
}

function applyDeposit(state: DeploymentAggState, change: Extract<AkashChange, { kind: "deploymentDeposited" }>, block: AkashBlockChanges): void {
  state.deposit += BigInt(change.amount);
  state.balance += decFromString(change.amount);

  const openLeases = state.leases.filter(lease => lease.closedHeight === null);
  const blockRate = sumLeaseRate(openLeases);
  for (const lease of openLeases) {
    lease.predictedClosedHeight = predictClosedHeight(state.lastWithdrawHeight ?? lease.createdHeight, state.balance, blockRate);
  }

  addEvent(state, block, change, "deposited", { amount: change.amount, denom: state.denom, ...(change.depositor ? { depositor: change.depositor } : {}) });
}

function applyDeploymentClose(state: DeploymentAggState, change: AkashChange, block: AkashBlockChanges, reason: DeploymentCloseReason): void {
  if (state.closedHeight !== null) {
    return;
  }
  settleState(state, block, change);
  if (state.closedHeight !== null) {
    return;
  }
  closeDeployment(state, block, reason);
  addEvent(state, block, change, "closed", { reason });
}

/**
 * Side-effect closes (group close, authz revoke) arrive as chain events rather than messages. The
 * chain settles the escrow account when it closes, so the fallback settles too — a deliberate fix
 * over the legacy indexer, which only stamped the height and let balances drift.
 */
function applyDeploymentCloseEvent(state: DeploymentAggState, change: AkashChange, block: AkashBlockChanges): void {
  if (state.closedHeight !== null) {
    return;
  }
  applyDeploymentClose(state, change, block, "close_event");
}

function applyGroupChange(
  state: DeploymentAggState,
  change: Extract<AkashChange, { kind: "groupClosed" | "groupPaused" | "groupStarted" }>,
  block: AkashBlockChanges,
  groupStateValue: GroupStateValue,
  eventType: DeploymentEventType
): void {
  const group = state.groups.find(candidate => candidate.gseq === change.gseq);
  if (!group || group.state === "closed") {
    return;
  }
  group.state = groupStateValue;
  if (groupStateValue === "closed") {
    group.closedHeight = block.height;
  }
  addEvent(state, block, change, eventType, { gseq: change.gseq });
}

function applyBidCreated(state: DeploymentAggState, change: Extract<AkashChange, { kind: "bidCreated" }>, block: AkashBlockChanges): void {
  const bid: BidAggState = {
    gseq: change.key.gseq,
    oseq: change.key.oseq,
    bseq: change.key.bseq,
    provider: change.key.provider,
    price: parsePrice(change.price),
    denom: change.priceDenom,
    state: "open",
    createdHeight: block.height,
    closedHeight: null
  };

  const existingIndex = state.bids.findIndex(candidate => sameLeaseKey(candidate, bid));
  if (existingIndex >= 0) {
    state.bids[existingIndex] = bid;
  } else {
    state.bids.push(bid);
  }

  addEvent(state, block, change, "bid_created", bidEventDetails(change.key, change.price, change.priceDenom));
}

function applyBidClosed(state: DeploymentAggState, change: Extract<AkashChange, { kind: "bidClosed" }>, block: AkashBlockChanges): void {
  const lease = findOpenLease(state, change.key);
  if (lease) {
    closeLease(state, lease, change, block);
  }

  const bid = state.bids.find(candidate => sameLeaseKey(candidate, change.key));
  if (bid && bid.state !== "closed") {
    bid.state = "closed";
    bid.closedHeight = block.height;
  }
  addEvent(state, block, change, "bid_closed", bidEventDetails(change.key));
}

function applyLeaseCreated(
  state: DeploymentAggState,
  change: Extract<AkashChange, { kind: "leaseCreated" }>,
  block: AkashBlockChanges,
  warnings: ReducerWarning[]
): void {
  const bid = state.bids.find(candidate => sameLeaseKey(candidate, change.key));
  const group = state.groups.find(candidate => candidate.gseq === change.key.gseq);
  if (!bid || !group) {
    warnings.push({ code: "AKASH_ORPHAN_REFERENCE", kind: change.kind, owner: change.key.owner, dseq: change.key.dseq, height: block.height });
  }

  const { blockRate } = settleState(state, block, change);
  const price = bid?.price ?? 0n;
  const predicted = predictClosedHeight(block.height, state.balance, blockRate + price);

  const lease: LeaseAggState = {
    gseq: change.key.gseq,
    oseq: change.key.oseq,
    bseq: change.key.bseq,
    provider: change.key.provider,
    price,
    denom: state.denom,
    balance: 0n,
    withdrawn: 0n,
    predictedClosedHeight: predicted,
    createdHeight: block.height,
    createdAt: block.datetime,
    closedHeight: null,
    closedAt: null,
    ...sumResourceTotals(group?.resources ?? [])
  };
  state.leases.push(lease);

  for (const openLease of state.leases.filter(candidate => candidate.closedHeight === null)) {
    openLease.predictedClosedHeight = predicted;
  }

  if (bid) {
    bid.state = "active";
  }

  closeLosingBids(state, change.key, block.height);

  addEvent(state, block, change, "lease_created", bidEventDetails(change.key, bid ? decToString(bid.price) : undefined, bid?.denom));
}

function applyLeaseClosed(state: DeploymentAggState, change: Extract<AkashChange, { kind: "leaseClosed" }>, block: AkashBlockChanges): void {
  const lease = findOpenLease(state, change.key);
  if (!lease) {
    return;
  }
  closeLease(state, lease, change, block);
  addEvent(state, block, change, "lease_closed", bidEventDetails(change.key));
}

function applyLeaseWithdrawn(
  state: DeploymentAggState,
  change: Extract<AkashChange, { kind: "leaseWithdrawn" }>,
  block: AkashBlockChanges,
  warnings: ReducerWarning[]
): void {
  const lease = state.leases.find(candidate => sameLeaseKey(candidate, change.key));
  if (!lease) {
    warnings.push({ code: "AKASH_ORPHAN_REFERENCE", kind: change.kind, owner: change.key.owner, dseq: change.key.dseq, height: block.height });
    return;
  }
  settleState(state, block, change);
  withdrawFromLease(state, lease);
  addEvent(state, block, change, "lease_withdrawn", bidEventDetails(change.key));
}

/** A lease closed by the chain without a direct message (its group closed, the order was revoked). Skipped when the close was already applied by the triggering message. */
function applyLeaseClosedEvent(state: DeploymentAggState, change: Extract<AkashChange, { kind: "leaseClosedEvent" }>, block: AkashBlockChanges): void {
  const lease = state.leases.find(
    candidate =>
      candidate.closedHeight === null &&
      candidate.gseq === change.gseq &&
      candidate.oseq === change.oseq &&
      candidate.provider === change.provider &&
      (change.bseq === null || candidate.bseq === change.bseq)
  );
  if (!lease) {
    return;
  }
  closeLease(state, lease, change, block);
  addEvent(state, block, change, "lease_closed", {
    gseq: change.gseq,
    oseq: change.oseq,
    bseq: change.bseq ?? lease.bseq,
    provider: change.provider
  });
}

/**
 * Shared close path for lease-terminating changes: settle first, pay out and close the lease, then
 * re-predict the remaining leases at the reduced block rate. Unlike the legacy indexer, the
 * deployment stays open when its last lease closes — the chain keeps the escrow account alive, and
 * actual deployment closes always arrive as a message, an overdraw, or a close event.
 */
function closeLease(state: DeploymentAggState, lease: LeaseAggState, change: AkashChange, block: AkashBlockChanges): void {
  const { blockRate } = settleState(state, block, change);

  if (lease.closedHeight === null) {
    lease.closedHeight = block.height;
    lease.closedAt = block.datetime;
    payOutClosedLease(state, lease);
  }

  if (state.closedHeight !== null) {
    return;
  }

  const remainingRate = blockRate - lease.price;
  for (const openLease of state.leases.filter(candidate => candidate.closedHeight === null)) {
    openLease.predictedClosedHeight = predictClosedHeight(state.lastWithdrawHeight ?? openLease.createdHeight, state.balance, remainingRate);
  }
}

/** Runs the escrow settlement and, when it overdraws, records the chain's forced close of the deployment and every open lease. */
function settleState(state: DeploymentAggState, block: AkashBlockChanges, change: AkashChange): { blockRate: bigint } {
  const openLeases = state.leases.filter(lease => lease.closedHeight === null);
  const { blockRate, overdrawn } = settle(state, openLeases, block.height);

  if (overdrawn) {
    for (const lease of openLeases) {
      lease.closedAt = block.datetime;
      payOutClosedLease(state, lease);
    }
    state.closedAt = block.datetime;
    state.closeReason = "overdrawn";
    closeOpenBids(state, block.height);
    addEvent(state, block, change, "closed", { reason: "overdrawn" });
  }

  return { blockRate };
}

/**
 * Mirrors the keeper's payout on withdraw: the whole-unit part of the accrued balance moves to the
 * lease's withdrawn total, the fraction stays accrued until the lease closes.
 */
function withdrawFromLease(state: DeploymentAggState, lease: LeaseAggState): void {
  const paid = decFromInt(decTruncateInt(lease.balance));
  lease.balance -= paid;
  lease.withdrawn += paid;
  state.withdrawn += paid;
}

/** On lease close the keeper pays out the whole units and refunds the fractional remainder to the account funds. */
function payOutClosedLease(state: DeploymentAggState, lease: LeaseAggState): void {
  withdrawFromLease(state, lease);
  state.balance += lease.balance;
  lease.balance = 0n;
}

function closeDeployment(state: DeploymentAggState, block: AkashBlockChanges, reason: DeploymentCloseReason): void {
  for (const lease of state.leases) {
    if (lease.closedHeight === null) {
      lease.closedHeight = block.height;
      lease.closedAt = block.datetime;
      payOutClosedLease(state, lease);
    }
  }
  closeOpenBids(state, block.height);
  state.closedHeight = block.height;
  state.closedAt = block.datetime;
  state.closeReason = reason;
}

/** The chain closes a deployment's open bids with it; the legacy indexer deleted bid rows instead, so this is state the rewrite adds. */
function closeOpenBids(state: DeploymentAggState, height: number): void {
  for (const bid of state.bids) {
    if (bid.state !== "closed") {
      bid.state = "closed";
      bid.closedHeight = height;
    }
  }
}

/** Creating a lease matches and closes the order, so the chain closes every other still-open bid on the same (gseq, oseq). */
function closeLosingBids(state: DeploymentAggState, winning: LeaseSlot, height: number): void {
  for (const bid of state.bids) {
    if (bid.state !== "closed" && bid.gseq === winning.gseq && bid.oseq === winning.oseq && !sameLeaseKey(bid, winning)) {
      bid.state = "closed";
      bid.closedHeight = height;
    }
  }
}

/**
 * The legacy predicted-close formula, `base + ceil(balance / rate)`, on exact math. A zero rate means
 * the balance never depletes; the prediction is pinned to the base height so draining queries treat
 * the lease as expired rather than dividing by zero.
 */
function predictClosedHeight(baseHeight: number, balance: bigint, blockRate: bigint): bigint {
  if (blockRate <= 0n) {
    return BigInt(baseHeight);
  }
  return BigInt(baseHeight) + decCeilInt(decQuo(balance, blockRate));
}

function addEvent(
  state: DeploymentAggState,
  block: AkashBlockChanges,
  change: AkashChange,
  type: DeploymentEventType,
  details: Record<string, unknown> | null
): void {
  const ordinal = state.events.filter(event => event.height === block.height).length;
  state.events.push({ height: block.height, ordinal, txIndex: change.txIndex, msgIndex: change.msgIndex, type, details });
}

function bidEventDetails(key: LeaseSlot, price?: string, denom?: string): Record<string, unknown> {
  return {
    gseq: key.gseq,
    oseq: key.oseq,
    bseq: key.bseq,
    provider: key.provider,
    ...(price !== undefined ? { price } : {}),
    ...(denom !== undefined && denom !== "" ? { denom } : {})
  };
}

function findOpenLease(state: DeploymentAggState, key: LeaseSlot): LeaseAggState | undefined {
  return state.leases.find(candidate => candidate.closedHeight === null && sameLeaseKey(candidate, key));
}

function sameLeaseKey(a: LeaseSlot, b: LeaseSlot): boolean {
  return a.gseq === b.gseq && a.oseq === b.oseq && a.bseq === b.bseq && a.provider === b.provider;
}

function sumGroupTotals(groups: NormalizedGroup[]): ResourceTotals {
  return groups.map(group => sumResourceTotals(group.resources)).reduce(addTotals, emptyTotals());
}

function sumResourceTotals(resources: NormalizedResource[]): ResourceTotals {
  return resources
    .map(resource => ({
      cpuUnits: resource.cpuUnits * resource.count,
      gpuUnits: resource.gpuUnits * resource.count,
      memoryBytes: resource.memoryBytes * resource.count,
      ephemeralStorageBytes: resource.ephemeralStorageBytes * resource.count,
      persistentStorageBytes: resource.persistentStorageBytes * resource.count
    }))
    .reduce(addTotals, emptyTotals());
}

function addTotals(a: ResourceTotals, b: ResourceTotals): ResourceTotals {
  return {
    cpuUnits: a.cpuUnits + b.cpuUnits,
    gpuUnits: a.gpuUnits + b.gpuUnits,
    memoryBytes: a.memoryBytes + b.memoryBytes,
    ephemeralStorageBytes: a.ephemeralStorageBytes + b.ephemeralStorageBytes,
    persistentStorageBytes: a.persistentStorageBytes + b.persistentStorageBytes
  };
}

function emptyTotals(): ResourceTotals {
  return { cpuUnits: 0, gpuUnits: 0, memoryBytes: 0, ephemeralStorageBytes: 0, persistentStorageBytes: 0 };
}

/** Bid prices are integer coins through v1beta2 and DecCoin decimal strings from v1beta3; a malformed price degrades to zero like the legacy `?? 0`. */
function parsePrice(price: string): bigint {
  try {
    return decFromString(price);
  } catch {
    return 0n;
  }
}
