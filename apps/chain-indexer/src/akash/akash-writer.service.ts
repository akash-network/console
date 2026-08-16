import { and, eq, inArray, or, sql } from "drizzle-orm";
import groupBy from "lodash/groupBy";
import { inject, singleton } from "tsyringe";

import type { AkashBlockChanges, DeploymentKey, NormalizedResource } from "@src/akash/akash-changes";
import { decFromString, decToString } from "@src/akash/dec";
import type { BidStateValue, DeploymentAggState, GroupStateValue, ReducerWarning } from "@src/akash/deployment-reducer";
import { applyBlockChanges, stateKey } from "@src/akash/deployment-reducer";
import { sumLeaseRate } from "@src/akash/settlement";
import { insertChunked } from "@src/db/insert-chunked";
import { Accounts, Bids, DeploymentEvents, DeploymentGroupResources, DeploymentGroups, Deployments, Leases } from "@src/db/schema";
import { sqlExcluded } from "@src/db/sql-excluded";
import type { ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

interface KeyedDeployment {
  key: DeploymentKey;
  ownerAccountId: number;
}

/**
 * Persists the deployment and market lifecycle inside the block transaction. The touched deployment
 * rows are locked `FOR UPDATE` in a deterministic order (so overlapping writers serialize instead of
 * deadlocking), folded in memory through the reducer in strict block order, and flushed as guarded
 * upserts. The per-deployment `last_processed_height` watermark makes a duplicate commit (replay,
 * overlapping pod) a no-op; like the balance ledger, this requires a deployment's messages to be
 * indexed in height order from its creation (backfill from genesis before live sync).
 */
@singleton()
export class AkashWriter {
  readonly #logger: LoggerService;

  constructor(@inject(LoggerService) logger: LoggerService) {
    this.#logger = logger;
    this.#logger.setContext("AKASH_WRITER");
  }

  async write(tx: ChainTransaction, blocks: AkashBlockChanges[], accountIds: Map<string, number>): Promise<void> {
    const withChanges = blocks.filter(block => block.changes.length > 0);
    if (withChanges.length === 0) {
      return;
    }

    const keyed = this.#collectKeys(withChanges, accountIds);
    const { states, deploymentIds, groupIds, loadedAddressIds } = await this.#loadStates(tx, keyed);

    const warnings = withChanges.flatMap(block => applyBlockChanges(states, block));
    this.#logWarnings(warnings);

    const touched = [...states.values()].filter(state => state.touched);
    if (touched.length === 0) {
      return;
    }

    /** Providers of bids and leases loaded from prior batches aren't in this batch's interned map, so their ids come from the loaded rows. */
    const addressIds = new Map([...loadedAddressIds, ...accountIds]);

    await this.#flushDeployments(tx, touched, addressIds, deploymentIds);
    await this.#flushGroups(tx, touched, deploymentIds, groupIds);
    await this.#flushGroupResources(tx, touched, deploymentIds, groupIds);
    await this.#flushBids(tx, touched, addressIds, deploymentIds);
    await this.#flushLeases(tx, touched, addressIds, deploymentIds, groupIds);
    await this.#flushEvents(tx, touched, deploymentIds);
  }

  /** Deterministic (ownerAccountId, dseq) order for both the row locks and the flush statements, so concurrent writers cannot deadlock. */
  #collectKeys(blocks: AkashBlockChanges[], accountIds: Map<string, number>): KeyedDeployment[] {
    const byKey = new Map<string, DeploymentKey>();
    for (const block of blocks) {
      for (const change of block.changes) {
        byKey.set(stateKey(change.key), change.key);
      }
    }

    return [...byKey.values()]
      .map(key => ({ key, ownerAccountId: this.#requireId(accountIds, key.owner) }))
      .sort((a, b) => a.ownerAccountId - b.ownerAccountId || compareDseq(a.key.dseq, b.key.dseq));
  }

  async #loadStates(
    tx: ChainTransaction,
    keyed: KeyedDeployment[]
  ): Promise<{
    states: Map<string, DeploymentAggState>;
    deploymentIds: Map<string, number>;
    groupIds: Map<string, number>;
    loadedAddressIds: Map<string, number>;
  }> {
    const states = new Map<string, DeploymentAggState>();
    const deploymentIds = new Map<string, number>();
    const groupIds = new Map<string, number>();
    const loadedAddressIds = new Map<string, number>();

    const deploymentRows = await this.#selectDeploymentsForUpdate(tx, keyed);
    if (deploymentRows.length === 0) {
      return { states, deploymentIds, groupIds, loadedAddressIds };
    }

    const keyByOwnerDseq = new Map(keyed.map(entry => [ownerDseqKey(entry.ownerAccountId, entry.key.dseq), entry.key]));
    const ids = deploymentRows.map(row => row.id);
    const [groupRows, resourceRows, bidRows, leaseRows] = await Promise.all([
      tx.select().from(DeploymentGroups).where(inArray(DeploymentGroups.deploymentId, ids)),
      tx
        .select({ resource: DeploymentGroupResources, deploymentId: DeploymentGroups.deploymentId, gseq: DeploymentGroups.gseq })
        .from(DeploymentGroupResources)
        .innerJoin(DeploymentGroups, eq(DeploymentGroupResources.deploymentGroupId, DeploymentGroups.id))
        .where(inArray(DeploymentGroups.deploymentId, ids)),
      tx.select().from(Bids).where(inArray(Bids.deploymentId, ids)),
      tx.select().from(Leases).where(inArray(Leases.deploymentId, ids))
    ]);

    const providerAddressById = await this.#providerAddresses(tx, [
      ...bidRows.map(row => row.providerAccountId),
      ...leaseRows.map(row => row.providerAccountId)
    ]);
    for (const [id, address] of providerAddressById) {
      loadedAddressIds.set(address, id);
    }

    const groupsByDeployment = groupBy(groupRows, row => row.deploymentId);
    const resourcesByGroup = groupBy(resourceRows, entry => `${entry.deploymentId}/${entry.gseq}`);
    const bidsByDeployment = groupBy(bidRows, row => row.deploymentId);
    const leasesByDeployment = groupBy(leaseRows, row => row.deploymentId);

    for (const row of deploymentRows) {
      const key = keyByOwnerDseq.get(ownerDseqKey(row.ownerAccountId, row.dseq));
      if (!key) {
        continue;
      }
      deploymentIds.set(stateKey(key), row.id);

      const groups = groupsByDeployment[row.id] ?? [];
      for (const group of groups) {
        groupIds.set(`${row.id}/${group.gseq}`, group.id);
      }

      states.set(stateKey(key), {
        key,
        denom: row.denom,
        deposit: BigInt(row.deposit),
        balance: decFromString(row.balance),
        withdrawn: decFromString(row.withdrawnAmount),
        lastWithdrawHeight: row.lastWithdrawHeight,
        lastProcessedHeight: row.lastProcessedHeight,
        createdHeight: row.createdHeight,
        createdAt: row.createdAt,
        closedHeight: row.closedHeight,
        closedAt: row.closedAt,
        closeReason: row.closeReason,
        cpuUnits: row.cpuUnits,
        gpuUnits: row.gpuUnits,
        memoryBytes: row.memoryBytes,
        ephemeralStorageBytes: row.ephemeralStorageBytes,
        persistentStorageBytes: row.persistentStorageBytes,
        groups: groups.map(group => ({
          gseq: group.gseq,
          state: group.state as GroupStateValue,
          closedHeight: group.closedHeight,
          resources: (resourcesByGroup[`${row.id}/${group.gseq}`] ?? [])
            .sort((a, b) => a.resource.idx - b.resource.idx)
            .map(entry => toNormalizedResource(entry.resource))
        })),
        bids: (bidsByDeployment[row.id] ?? []).map(bid => ({
          gseq: bid.gseq,
          oseq: bid.oseq,
          bseq: bid.bseq,
          provider: this.#requireAddress(providerAddressById, bid.providerAccountId),
          price: decFromString(bid.price),
          denom: bid.denom,
          state: bid.state as BidStateValue,
          createdHeight: bid.createdHeight,
          closedHeight: bid.closedHeight
        })),
        leases: (leasesByDeployment[row.id] ?? []).map(lease => ({
          gseq: lease.gseq,
          oseq: lease.oseq,
          bseq: lease.bseq,
          provider: this.#requireAddress(providerAddressById, lease.providerAccountId),
          price: decFromString(lease.price),
          denom: lease.denom,
          balance: decFromString(lease.balance),
          withdrawn: decFromString(lease.withdrawnAmount),
          predictedClosedHeight: BigInt(lease.predictedClosedHeight),
          createdHeight: lease.createdHeight,
          createdAt: lease.createdAt,
          closedHeight: lease.closedHeight,
          closedAt: lease.closedAt,
          cpuUnits: lease.cpuUnits,
          gpuUnits: lease.gpuUnits,
          memoryBytes: lease.memoryBytes,
          ephemeralStorageBytes: lease.ephemeralStorageBytes,
          persistentStorageBytes: lease.persistentStorageBytes
        })),
        events: [],
        isNew: false,
        touched: false
      });
    }

    return { states, deploymentIds, groupIds, loadedAddressIds };
  }

  async #selectDeploymentsForUpdate(tx: ChainTransaction, keyed: KeyedDeployment[]) {
    const filters = keyed.map(entry => and(eq(Deployments.ownerAccountId, entry.ownerAccountId), eq(Deployments.dseq, entry.key.dseq)));
    return tx
      .select()
      .from(Deployments)
      .where(or(...filters))
      .orderBy(Deployments.ownerAccountId, Deployments.dseq)
      .for("update");
  }

  /** Bid and lease provider addresses are only stored as account ids; the reducer keys leases by address, so resolve them back. */
  async #providerAddresses(tx: ChainTransaction, providerAccountIds: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(providerAccountIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await tx.select({ id: Accounts.id, address: Accounts.address }).from(Accounts).where(inArray(Accounts.id, unique));
    return new Map(rows.map(row => [row.id, row.address]));
  }

  async #flushDeployments(
    tx: ChainTransaction,
    touched: DeploymentAggState[],
    accountIds: Map<string, number>,
    deploymentIds: Map<string, number>
  ): Promise<void> {
    const rows = touched.map(state => ({
      ownerAccountId: this.#requireId(accountIds, state.key.owner),
      dseq: state.key.dseq,
      denom: state.denom,
      deposit: state.deposit.toString(),
      balance: decToString(state.balance),
      withdrawnAmount: decToString(state.withdrawn),
      blockRate: decToString(sumLeaseRate(state.leases.filter(lease => lease.closedHeight === null))),
      lastWithdrawHeight: state.lastWithdrawHeight,
      lastProcessedHeight: state.lastProcessedHeight,
      createdHeight: state.createdHeight,
      createdAt: state.createdAt,
      closedHeight: state.closedHeight,
      closedAt: state.closedAt,
      closeReason: state.closeReason,
      cpuUnits: state.cpuUnits,
      gpuUnits: state.gpuUnits,
      memoryBytes: state.memoryBytes,
      ephemeralStorageBytes: state.ephemeralStorageBytes,
      persistentStorageBytes: state.persistentStorageBytes
    }));

    const inserted = await tx
      .insert(Deployments)
      .values(rows)
      .onConflictDoUpdate({
        target: [Deployments.ownerAccountId, Deployments.dseq],
        set: {
          denom: sqlExcluded("denom"),
          deposit: sqlExcluded("deposit"),
          balance: sqlExcluded("balance"),
          withdrawnAmount: sqlExcluded("withdrawn_amount"),
          blockRate: sqlExcluded("block_rate"),
          lastWithdrawHeight: sqlExcluded("last_withdraw_height"),
          lastProcessedHeight: sqlExcluded("last_processed_height"),
          closedHeight: sqlExcluded("closed_height"),
          closedAt: sqlExcluded("closed_at"),
          closeReason: sqlExcluded("close_reason")
        },
        setWhere: sql`excluded.last_processed_height >= ${Deployments.lastProcessedHeight}`
      })
      .returning({ id: Deployments.id, ownerAccountId: Deployments.ownerAccountId, dseq: Deployments.dseq });

    const idByOwnerDseq = new Map(inserted.map(row => [ownerDseqKey(row.ownerAccountId, row.dseq), row.id]));
    for (const state of touched) {
      const id = idByOwnerDseq.get(ownerDseqKey(this.#requireId(accountIds, state.key.owner), state.key.dseq));
      if (id !== undefined) {
        deploymentIds.set(stateKey(state.key), id);
      }
    }

    const missing = touched.filter(state => !deploymentIds.has(stateKey(state.key)));
    if (missing.length > 0) {
      const rowsForMissing = await this.#selectDeploymentsForUpdate(
        tx,
        missing.map(state => ({ key: state.key, ownerAccountId: this.#requireId(accountIds, state.key.owner) }))
      );
      const keyByOwnerDseq = new Map(missing.map(state => [ownerDseqKey(this.#requireId(accountIds, state.key.owner), state.key.dseq), state.key]));
      for (const row of rowsForMissing) {
        const key = keyByOwnerDseq.get(ownerDseqKey(row.ownerAccountId, row.dseq));
        if (key) {
          deploymentIds.set(stateKey(key), row.id);
        }
      }
    }
  }

  async #flushGroups(tx: ChainTransaction, touched: DeploymentAggState[], deploymentIds: Map<string, number>, groupIds: Map<string, number>): Promise<void> {
    const rows = touched.flatMap(state => {
      const deploymentId = this.#requireDeploymentId(deploymentIds, state);
      return state.groups.map(group => ({ deploymentId, gseq: group.gseq, state: group.state, closedHeight: group.closedHeight }));
    });
    if (rows.length === 0) {
      return;
    }

    const affected = await tx
      .insert(DeploymentGroups)
      .values(rows)
      .onConflictDoUpdate({
        target: [DeploymentGroups.deploymentId, DeploymentGroups.gseq],
        set: { state: sqlExcluded("state"), closedHeight: sqlExcluded("closed_height") }
      })
      .returning({ id: DeploymentGroups.id, deploymentId: DeploymentGroups.deploymentId, gseq: DeploymentGroups.gseq });

    for (const row of affected) {
      groupIds.set(`${row.deploymentId}/${row.gseq}`, row.id);
    }
  }

  async #flushGroupResources(
    tx: ChainTransaction,
    touched: DeploymentAggState[],
    deploymentIds: Map<string, number>,
    groupIds: Map<string, number>
  ): Promise<void> {
    const rows = touched
      .filter(state => state.isNew)
      .flatMap(state =>
        state.groups.flatMap(group =>
          group.resources.map((resource, idx) => ({
            deploymentGroupId: this.#requireGroupId(groupIds, this.#requireDeploymentId(deploymentIds, state), group.gseq),
            idx,
            count: resource.count,
            cpuUnits: resource.cpuUnits,
            gpuUnits: resource.gpuUnits,
            gpuVendor: resource.gpuVendor,
            gpuModel: resource.gpuModel,
            memoryBytes: resource.memoryBytes,
            ephemeralStorageBytes: resource.ephemeralStorageBytes,
            persistentStorageBytes: resource.persistentStorageBytes,
            price: resource.price,
            priceDenom: resource.priceDenom
          }))
        )
      );
    await insertChunked(tx, DeploymentGroupResources, rows);
  }

  async #flushBids(tx: ChainTransaction, touched: DeploymentAggState[], accountIds: Map<string, number>, deploymentIds: Map<string, number>): Promise<void> {
    const rows = touched.flatMap(state => {
      const deploymentId = this.#requireDeploymentId(deploymentIds, state);
      return state.bids.map(bid => ({
        deploymentId,
        gseq: bid.gseq,
        oseq: bid.oseq,
        bseq: bid.bseq,
        providerAccountId: this.#requireId(accountIds, bid.provider),
        price: decToString(bid.price),
        denom: bid.denom,
        state: bid.state,
        createdHeight: bid.createdHeight,
        closedHeight: bid.closedHeight
      }));
    });
    if (rows.length === 0) {
      return;
    }

    await tx
      .insert(Bids)
      .values(rows)
      .onConflictDoUpdate({
        target: [Bids.deploymentId, Bids.gseq, Bids.oseq, Bids.bseq, Bids.providerAccountId],
        set: {
          price: sqlExcluded("price"),
          denom: sqlExcluded("denom"),
          state: sqlExcluded("state"),
          createdHeight: sqlExcluded("created_height"),
          closedHeight: sqlExcluded("closed_height")
        }
      });
  }

  async #flushLeases(
    tx: ChainTransaction,
    touched: DeploymentAggState[],
    accountIds: Map<string, number>,
    deploymentIds: Map<string, number>,
    groupIds: Map<string, number>
  ): Promise<void> {
    const rows = touched.flatMap(state => {
      const deploymentId = this.#requireDeploymentId(deploymentIds, state);
      return state.leases.map(lease => ({
        deploymentId,
        deploymentGroupId: this.#requireGroupId(groupIds, deploymentId, lease.gseq),
        gseq: lease.gseq,
        oseq: lease.oseq,
        bseq: lease.bseq,
        providerAccountId: this.#requireId(accountIds, lease.provider),
        price: decToString(lease.price),
        denom: lease.denom,
        balance: decToString(lease.balance),
        withdrawnAmount: decToString(lease.withdrawn),
        predictedClosedHeight: lease.predictedClosedHeight.toString(),
        createdHeight: lease.createdHeight,
        createdAt: lease.createdAt,
        closedHeight: lease.closedHeight,
        closedAt: lease.closedAt,
        cpuUnits: lease.cpuUnits,
        gpuUnits: lease.gpuUnits,
        memoryBytes: lease.memoryBytes,
        ephemeralStorageBytes: lease.ephemeralStorageBytes,
        persistentStorageBytes: lease.persistentStorageBytes
      }));
    });
    if (rows.length === 0) {
      return;
    }

    await tx
      .insert(Leases)
      .values(rows)
      .onConflictDoUpdate({
        target: [Leases.deploymentId, Leases.gseq, Leases.oseq, Leases.bseq, Leases.providerAccountId],
        set: {
          balance: sqlExcluded("balance"),
          withdrawnAmount: sqlExcluded("withdrawn_amount"),
          predictedClosedHeight: sqlExcluded("predicted_closed_height"),
          closedHeight: sqlExcluded("closed_height"),
          closedAt: sqlExcluded("closed_at")
        }
      });
  }

  async #flushEvents(tx: ChainTransaction, touched: DeploymentAggState[], deploymentIds: Map<string, number>): Promise<void> {
    const rows = touched.flatMap(state => {
      const deploymentId = this.#requireDeploymentId(deploymentIds, state);
      return state.events.map(event => ({
        deploymentId,
        height: event.height,
        ordinal: event.ordinal,
        txIndex: event.txIndex,
        msgIndex: event.msgIndex,
        type: event.type,
        details: event.details
      }));
    });
    await insertChunked(tx, DeploymentEvents, rows);
  }

  #logWarnings(warnings: ReducerWarning[]): void {
    if (warnings.length === 0) {
      return;
    }
    const byCode = new Map<string, ReducerWarning[]>();
    for (const warning of warnings) {
      byCode.set(warning.code, [...(byCode.get(warning.code) ?? []), warning]);
    }
    for (const [code, group] of byCode) {
      this.#logger.warn({ event: code, count: group.length, samples: group.slice(0, 5) });
    }
  }

  #requireId(accountIds: Map<string, number>, address: string): number {
    const id = accountIds.get(address);
    if (id === undefined) {
      throw new Error(`No interned account id for address ${address}`);
    }
    return id;
  }

  #requireAddress(addressesById: Map<number, string>, accountId: number): string {
    const address = addressesById.get(accountId);
    if (address === undefined) {
      throw new Error(`No account row for id ${accountId}`);
    }
    return address;
  }

  #requireDeploymentId(deploymentIds: Map<string, number>, state: DeploymentAggState): number {
    const id = deploymentIds.get(stateKey(state.key));
    if (id === undefined) {
      throw new Error(`No deployment id for ${stateKey(state.key)}`);
    }
    return id;
  }

  #requireGroupId(groupIds: Map<string, number>, deploymentId: number, gseq: number): number {
    const id = groupIds.get(`${deploymentId}/${gseq}`);
    if (id === undefined) {
      throw new Error(`No deployment group id for deployment ${deploymentId} gseq ${gseq}`);
    }
    return id;
  }
}

function toNormalizedResource(resource: typeof DeploymentGroupResources.$inferSelect): NormalizedResource {
  return {
    count: resource.count,
    cpuUnits: resource.cpuUnits,
    gpuUnits: resource.gpuUnits,
    gpuVendor: resource.gpuVendor,
    gpuModel: resource.gpuModel,
    memoryBytes: resource.memoryBytes,
    ephemeralStorageBytes: resource.ephemeralStorageBytes,
    persistentStorageBytes: resource.persistentStorageBytes,
    price: resource.price,
    priceDenom: resource.priceDenom
  };
}

/** Postgres normalizes numeric literals (e.g. strips leading zeros), so dseq comparisons go through one canonical form. */
function normalizeDseq(dseq: string): string {
  return BigInt(dseq).toString();
}

/** The (interned owner account id, canonical dseq) pair that keys a deployment across the load and flush maps. */
function ownerDseqKey(ownerAccountId: number, dseq: string): string {
  return `${ownerAccountId}/${normalizeDseq(dseq)}`;
}

function compareDseq(a: string, b: string): number {
  const left = BigInt(a);
  const right = BigInt(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
