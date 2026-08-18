import { fromBech32 } from "@cosmjs/encoding";
import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import {
  conversionBankContribution,
  convertDeploymentAmounts,
  convertLeaseAmounts,
  convertPriceAmount,
  parseRate,
  RATE_ONE
} from "@src/bme/act-migration-convert";
import type { ActConversionBankTotals } from "@src/bme/act-migration-deriver";
import { deriveActMigrationSignals, IBC_USDC_DENOMS } from "@src/bme/act-migration-deriver";
import {
  Accounts,
  ActMigrationQueue,
  ActMigrationState,
  Bids,
  DeploymentGroupResources,
  DeploymentGroups,
  Deployments,
  IndexerState,
  Leases
} from "@src/db/schema";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

export const ACT_MIGRATION_STREAMS = {
  upgrade: "act-migration:upgrade",
  drained: "act-migration:drained",
  drainAt: (height: number) => `act-migration:drain:${height}`
} as const;

/** Queue rows are read in chunks until the block's burn/mint totals are reached. */
const DRAIN_CHUNK_SIZE = 500;

export type ActMigrationStep =
  | { kind: "upgrade"; height: number; bankTotals: ActConversionBankTotals; validatable: boolean }
  | { kind: "drain"; height: number; aktUsdRate: string; bankTotals: ActConversionBankTotals; validatable: boolean };

interface SegmentObservations {
  lastAktUsdPrice: { price: string; height: number } | null;
}

export interface ActMigrationSegment {
  blocks: DecodedBlock[];
  step: ActMigrationStep | null;
  observations: SegmentObservations;
}

export interface ActMigrationOutcome {
  upgradeApplied?: boolean;
  queueRemaining?: number;
  drained?: boolean;
}

/**
 * In-place escrow denom conversion mirroring what the BME network upgrade did to chain state
 * without per-account events. At the upgrade block (first native BME event) the chain converted
 * axlUSDC deployments to uact at par and queued every open uakt deployment; its deployment
 * EndBlocker then drained the queue over the following blocks, each block converting at the
 * oracle's aggregated AKT/USD price stored at the previous block. How many deployments each block
 * drained is chain-version-dependent (the sandbox RC drained everything at once, v2.0.0 caps at 50
 * per block), so the drain follows the observable record instead: each block's BME-module
 * burn/coinbase totals say exactly how much was converted, and queue entries are consumed in the
 * chain's order until the computed totals match them. A rate or ordering error therefore cannot
 * corrupt silently — the totals fail to bind and the block aborts. The rate is the latest
 * `EventPriceData` from strictly earlier blocks, matching the one-block lag of the oracle's stored
 * aggregate. Every step claims an `indexer_state` marker, so replays and concurrent writers are
 * exactly-once.
 *
 * Correctness inherits the pipeline's ordering contract (blocks processed in height order from a
 * deployment's creation), and the drain additionally assumes full history: a partial-window
 * backfill carries only a subset of the chain's queue, which surfaces as a logged shortfall. A
 * module replay that rebuilds deployments from scratch must clear the `act-migration:*` markers
 * and queue together with the module's rows, or replayed pre-upgrade rows would keep their
 * creation-era denoms.
 */
@singleton()
export class ActMigrationService {
  readonly #db: ChainDatabase;
  readonly #logger: LoggerService;
  #loaded = false;
  #upgradeApplied = false;
  #drained = false;
  #lastAktUsdPrice: string | null = null;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#logger = logger;
    this.#logger.setContext("ACT_MIGRATION");
  }

  /**
   * Splits a contiguous batch so each conversion step lands at the end of its own segment: the
   * committer commits blocks up to and including the step block, applies the conversion in that
   * same transaction, and only then processes later blocks — whose settlements must already see
   * converted state. Planning never mutates the durable in-memory state; `markCommitted` folds a
   * segment in only after its transaction committed, so a failed commit replans from scratch.
   */
  async segment(blocks: DecodedBlock[]): Promise<ActMigrationSegment[]> {
    if (blocks.length === 0) {
      return [];
    }
    await this.#ensureLoaded();
    if (this.#drained) {
      return [{ blocks, step: null, observations: { lastAktUsdPrice: null } }];
    }

    const segments: ActMigrationSegment[] = [];
    let upgradeApplied = this.#upgradeApplied;
    let lastPrice = this.#lastAktUsdPrice;
    let segmentStart = 0;
    let observations: SegmentObservations = { lastAktUsdPrice: null };

    blocks.forEach((block, index) => {
      const signals = deriveActMigrationSignals(block);

      let step: ActMigrationStep | null = null;
      if (!upgradeApplied && signals.hasNativeBmeEvent) {
        upgradeApplied = true;
        step = { kind: "upgrade", height: block.height, bankTotals: signals.bankTotals, validatable: !signals.hasLedgerExecutedEvent };
      } else if (upgradeApplied && signals.bankTotals.burnedUakt > 0n && signals.bankTotals.mintedUact > 0n) {
        if (lastPrice === null) {
          throw new Error(
            `Block ${block.height} converted escrow (burned ${signals.bankTotals.burnedUakt}uakt) but no AKT/USD oracle price was seen in earlier blocks`
          );
        }
        step = { kind: "drain", height: block.height, aktUsdRate: lastPrice, bankTotals: signals.bankTotals, validatable: !signals.hasLedgerExecutedEvent };
      }

      if (signals.lastAktUsdPrice !== null) {
        lastPrice = signals.lastAktUsdPrice;
        observations.lastAktUsdPrice = { price: signals.lastAktUsdPrice, height: block.height };
      }

      if (step !== null) {
        segments.push({ blocks: blocks.slice(segmentStart, index + 1), step, observations });
        segmentStart = index + 1;
        observations = { lastAktUsdPrice: null };
      }
    });

    if (segmentStart < blocks.length) {
      segments.push({ blocks: blocks.slice(segmentStart), step: null, observations });
    }
    return segments;
  }

  async applySegment(tx: ChainTransaction, segment: ActMigrationSegment): Promise<ActMigrationOutcome | null> {
    if (this.#drained || (segment.step === null && segment.observations.lastAktUsdPrice === null)) {
      return null;
    }

    if (segment.observations.lastAktUsdPrice !== null) {
      await this.#persistLastPrice(tx, segment.observations.lastAktUsdPrice);
    }
    if (segment.step === null) {
      return null;
    }

    return segment.step.kind === "upgrade" ? this.#applyUpgrade(tx, segment.step) : this.#applyDrain(tx, segment.step);
  }

  /** Fold a segment into the durable in-memory state only after its transaction committed. */
  markCommitted(segment: ActMigrationSegment, outcome: ActMigrationOutcome | null): void {
    if (segment.observations.lastAktUsdPrice !== null) {
      this.#lastAktUsdPrice = segment.observations.lastAktUsdPrice.price;
    }
    if (segment.step?.kind === "upgrade" || outcome?.upgradeApplied) {
      this.#upgradeApplied = true;
    }
    if (outcome?.drained) {
      this.#drained = true;
    }
  }

  /**
   * The upgrade block's conversion: axlUSDC deployments convert to uact at par immediately, and
   * every open uakt deployment enters the drain queue in the chain's order — lexicographic owner
   * address, then dseq. Denoms are detected from the first non-zero group resource price, exactly
   * like the chain's `DetectDenom`; deployments whose groups carry no priced resources are skipped
   * on chain and stay unconverted here too.
   */
  async #applyUpgrade(tx: ChainTransaction, step: ActMigrationStep): Promise<ActMigrationOutcome | null> {
    const claimed = await this.#claimMarker(tx, ACT_MIGRATION_STREAMS.upgrade, step.height);
    if (!claimed) {
      this.#logger.info({ event: "ACT_MIGRATION_UPGRADE_ALREADY_APPLIED", height: step.height });
      return { upgradeApplied: true };
    }

    const open = await tx
      .select({
        id: Deployments.id,
        denom: Deployments.denom,
        balance: Deployments.balance,
        dseq: Deployments.dseq,
        owner: Accounts.address
      })
      .from(Deployments)
      .innerJoin(Accounts, eq(Deployments.ownerAccountId, Accounts.id))
      .where(isNull(Deployments.closedHeight));
    const openIds = open.map(deployment => deployment.id);

    const detected = await this.#detectDenoms(tx, openIds);
    const usdc = open.filter(deployment => {
      const detectedDenom = detected.get(deployment.id);
      return detectedDenom !== undefined && IBC_USDC_DENOMS.includes(detectedDenom);
    });
    const uakt = orderByChainDrainSequence(open.filter(deployment => detected.get(deployment.id) === "uakt"));

    const usdcIds = usdc.map(deployment => deployment.id);
    const converted = await this.#renameUsdcToAct(tx, usdcIds);

    if (uakt.length > 0) {
      await tx.insert(ActMigrationQueue).values(uakt.map((deployment, position) => ({ position, deploymentId: deployment.id })));
    }

    const drained = await this.#claimDrainedIfEmpty(tx, step.height, uakt.length);

    await this.#validateUsdcTotals(tx, step, usdc, usdcIds);

    this.#logger.info({
      event: "ACT_MIGRATION_UPGRADE_APPLIED",
      height: step.height,
      usdcDeployments: usdcIds.length,
      usdcLeases: converted.leases,
      queueSeeded: uakt.length
    });

    return { upgradeApplied: true, queueRemaining: uakt.length, drained };
  }

  /**
   * One drain block: consume queue entries in order — converting the open uakt ones at this block's
   * rate, spending the slot of any that closed while queued — until the computed burn/mint totals
   * equal the block's bank events. Overshooting the totals means the rate or queue order is wrong
   * and aborts the transaction; running out of queue first means this database carries only part of
   * the chain's history (a partial-window backfill) and is reported as a shortfall.
   */
  async #applyDrain(tx: ChainTransaction, step: ActMigrationStep & { kind: "drain" }): Promise<ActMigrationOutcome | null> {
    const claimed = await this.#claimMarker(tx, ACT_MIGRATION_STREAMS.drainAt(step.height), step.height);
    if (!claimed) {
      this.#logger.info({ event: "ACT_MIGRATION_DRAIN_ALREADY_APPLIED", height: step.height });
      return null;
    }

    const [{ remaining: pending }] = await tx
      .select({ remaining: sql<number>`COUNT(*)::int` })
      .from(ActMigrationQueue)
      .where(isNull(ActMigrationQueue.convertedAtHeight));
    if (await this.#claimDrainedIfEmpty(tx, step.height, pending)) {
      return { queueRemaining: 0, drained: true };
    }

    if (!step.validatable) {
      throw new Error(`Block ${step.height} mixes BME ledger executions with an unfinished denom drain; its bank totals cannot bind the conversion boundary`);
    }

    const rate = parseRate(step.aktUsdRate);
    let burned = 0n;
    let minted = 0n;
    let convertedCount = 0;
    let skippedClosed = 0;
    const consumedPositions: number[] = [];
    let cutReached = false;
    let positionCursor = -1;

    while (!cutReached) {
      const slots = await tx
        .select({ position: ActMigrationQueue.position, deploymentId: ActMigrationQueue.deploymentId })
        .from(ActMigrationQueue)
        .where(and(isNull(ActMigrationQueue.convertedAtHeight), gt(ActMigrationQueue.position, positionCursor)))
        .orderBy(ActMigrationQueue.position)
        .limit(DRAIN_CHUNK_SIZE)
        .for("update");
      if (slots.length === 0) {
        break;
      }
      positionCursor = slots[slots.length - 1].position;

      const deploymentIds = slots.map(slot => slot.deploymentId);
      const [deployments, leases] = await Promise.all([
        tx.select().from(Deployments).where(inArray(Deployments.id, deploymentIds)).for("update"),
        tx
          .select()
          .from(Leases)
          .where(and(inArray(Leases.deploymentId, deploymentIds), isNull(Leases.closedHeight), eq(Leases.denom, "uakt")))
      ]);
      const deploymentById = new Map(deployments.map(deployment => [deployment.id, deployment]));
      const leasesByDeployment = new Map<number, typeof leases>();
      for (const lease of leases) {
        leasesByDeployment.set(lease.deploymentId, [...(leasesByDeployment.get(lease.deploymentId) ?? []), lease]);
      }

      for (const slot of slots) {
        const deployment = deploymentById.get(slot.deploymentId);
        if (!deployment || deployment.closedHeight !== null || deployment.denom !== "uakt") {
          skippedClosed += 1;
          consumedPositions.push(slot.position);
          continue;
        }

        const deploymentLeases = leasesByDeployment.get(slot.deploymentId) ?? [];
        const contribution = conversionBankContribution({ balance: deployment.balance, leaseBalances: deploymentLeases.map(lease => lease.balance) }, rate);
        if (burned + contribution.burned > step.bankTotals.burnedUakt || minted + contribution.minted > step.bankTotals.mintedUact) {
          throw new Error(
            `ACT drain at block ${step.height} overshoots the chain's totals: queue position ${slot.position} would push ` +
              `burned to ${burned + contribution.burned}/${step.bankTotals.burnedUakt}uakt and minted to ` +
              `${minted + contribution.minted}/${step.bankTotals.mintedUact}uact — rate ${step.aktUsdRate} or queue order is wrong`
          );
        }

        burned += contribution.burned;
        minted += contribution.minted;

        await tx
          .update(Deployments)
          .set({ denom: "uact", ...convertDeploymentAmounts(deployment, rate) })
          .where(eq(Deployments.id, deployment.id));

        for (const lease of deploymentLeases) {
          await tx
            .update(Leases)
            .set({ denom: "uact", ...convertLeaseAmounts(lease, rate) })
            .where(
              and(
                eq(Leases.deploymentId, lease.deploymentId),
                eq(Leases.gseq, lease.gseq),
                eq(Leases.oseq, lease.oseq),
                eq(Leases.bseq, lease.bseq),
                eq(Leases.providerAccountId, lease.providerAccountId)
              )
            );
        }

        await this.#convertBidPrices(tx, deployment.id, "uakt", rate);
        await this.#convertGroupResourcePrices(tx, deployment.id, ["uakt"], rate);
        convertedCount += 1;
        consumedPositions.push(slot.position);

        cutReached = burned === step.bankTotals.burnedUakt && minted === step.bankTotals.mintedUact;
        if (cutReached) {
          break;
        }
      }
    }

    if (consumedPositions.length > 0) {
      await tx.update(ActMigrationQueue).set({ convertedAtHeight: step.height }).where(inArray(ActMigrationQueue.position, consumedPositions));
    }

    const [{ remaining }] = await tx
      .select({ remaining: sql<number>`COUNT(*)::int` })
      .from(ActMigrationQueue)
      .where(isNull(ActMigrationQueue.convertedAtHeight));
    const drained = await this.#claimDrainedIfEmpty(tx, step.height, remaining);

    const logPayload = {
      event: cutReached ? "ACT_MIGRATION_DRAIN_APPLIED" : "ACT_MIGRATION_DRAIN_SHORTFALL",
      height: step.height,
      aktUsdRate: step.aktUsdRate,
      converted: convertedCount,
      skippedClosed,
      remaining,
      burnedUakt: burned.toString(),
      mintedUact: minted.toString(),
      eventBurnedUakt: step.bankTotals.burnedUakt.toString(),
      eventMintedUact: step.bankTotals.mintedUact.toString()
    };
    if (cutReached) {
      this.#logger.info(logPayload);
    } else {
      this.#logger.warn(logPayload);
    }

    return { queueRemaining: remaining, drained };
  }

  /** axlUSDC converts at par: pure denom renames, amounts untouched — multiplying by one is exact. */
  async #renameUsdcToAct(tx: ChainTransaction, usdcIds: number[]): Promise<{ leases: number }> {
    if (usdcIds.length > 0) {
      await tx.update(Deployments).set({ denom: "uact" }).where(inArray(Deployments.id, usdcIds));
      await this.#convertBidPrices(tx, usdcIds, IBC_USDC_DENOMS, RATE_ONE);
      for (const deploymentId of usdcIds) {
        await this.#convertGroupResourcePrices(tx, deploymentId, IBC_USDC_DENOMS, RATE_ONE);
      }
    }

    const orphanOwnerFilter = or(
      usdcIds.length > 0 ? inArray(Leases.deploymentId, usdcIds) : sql`false`,
      inArray(Leases.deploymentId, tx.select({ id: Deployments.id }).from(Deployments).where(isNotNull(Deployments.closedHeight)))
    );
    const renamedLeases = await tx
      .update(Leases)
      .set({ denom: "uact" })
      .where(and(eq(Leases.denom, "uusdc"), isNull(Leases.closedHeight), orphanOwnerFilter))
      .returning({ deploymentId: Leases.deploymentId });

    return { leases: renamedLeases.length };
  }

  async #convertBidPrices(tx: ChainTransaction, deploymentIds: number | number[], fromDenoms: string | readonly string[], rate: bigint): Promise<void> {
    const idFilter = Array.isArray(deploymentIds) ? inArray(Bids.deploymentId, deploymentIds) : eq(Bids.deploymentId, deploymentIds as number);
    const denomFilter = typeof fromDenoms === "string" ? eq(Bids.denom, fromDenoms) : inArray(Bids.denom, [...fromDenoms]);
    const bids = await tx
      .select()
      .from(Bids)
      .where(and(idFilter, denomFilter, inArray(Bids.state, ["open", "active"])));

    for (const bid of bids) {
      await tx
        .update(Bids)
        .set({ denom: "uact", price: convertPriceAmount(bid.price, rate) })
        .where(
          and(
            eq(Bids.deploymentId, bid.deploymentId),
            eq(Bids.gseq, bid.gseq),
            eq(Bids.oseq, bid.oseq),
            eq(Bids.bseq, bid.bseq),
            eq(Bids.providerAccountId, bid.providerAccountId)
          )
        );
    }
  }

  async #convertGroupResourcePrices(tx: ChainTransaction, deploymentId: number, fromDenoms: readonly string[], rate: bigint): Promise<void> {
    const resources = await tx
      .select({
        deploymentGroupId: DeploymentGroupResources.deploymentGroupId,
        idx: DeploymentGroupResources.idx,
        price: DeploymentGroupResources.price,
        priceDenom: DeploymentGroupResources.priceDenom
      })
      .from(DeploymentGroupResources)
      .innerJoin(DeploymentGroups, eq(DeploymentGroupResources.deploymentGroupId, DeploymentGroups.id))
      .where(
        and(
          eq(DeploymentGroups.deploymentId, deploymentId),
          inArray(DeploymentGroups.state, ["open", "paused"]),
          inArray(DeploymentGroupResources.priceDenom, [...fromDenoms])
        )
      );

    for (const resource of resources) {
      await tx
        .update(DeploymentGroupResources)
        .set({ priceDenom: "uact", price: convertPriceAmount(resource.price, rate) })
        .where(and(eq(DeploymentGroupResources.deploymentGroupId, resource.deploymentGroupId), eq(DeploymentGroupResources.idx, resource.idx)));
    }
  }

  /** Mirrors the chain's `DetectDenom`: the first non-zero resource price by group then resource order names the deployment's denom. */
  async #detectDenoms(tx: ChainTransaction, deploymentIds: number[]): Promise<Map<number, string>> {
    if (deploymentIds.length === 0) {
      return new Map();
    }
    const resources = await tx
      .select({
        deploymentId: DeploymentGroups.deploymentId,
        gseq: DeploymentGroups.gseq,
        idx: DeploymentGroupResources.idx,
        price: DeploymentGroupResources.price,
        priceDenom: DeploymentGroupResources.priceDenom
      })
      .from(DeploymentGroupResources)
      .innerJoin(DeploymentGroups, eq(DeploymentGroupResources.deploymentGroupId, DeploymentGroups.id))
      .where(inArray(DeploymentGroups.deploymentId, deploymentIds))
      .orderBy(DeploymentGroups.deploymentId, DeploymentGroups.gseq, DeploymentGroupResources.idx);

    const detected = new Map<number, string>();
    for (const resource of resources) {
      if (!detected.has(resource.deploymentId) && resource.price !== "0" && Number(resource.price) !== 0) {
        detected.set(resource.deploymentId, resource.priceDenom);
      }
    }
    return detected;
  }

  /**
   * Advisory: the chain's upgrade also converted orphaned escrow accounts of closed deployments,
   * which this model does not track, so the event totals may exceed the computed ones. A shortfall
   * the other way would mean the conversion model is wrong.
   */
  async #validateUsdcTotals(tx: ChainTransaction, step: ActMigrationStep, usdc: Array<{ id: number; balance: string }>, usdcIds: number[]): Promise<void> {
    if (!step.validatable) {
      return;
    }

    let expectedBurned = 0n;
    let expectedMinted = 0n;
    if (usdcIds.length > 0) {
      const usdcLeases = await tx
        .select({ deploymentId: Leases.deploymentId, balance: Leases.balance })
        .from(Leases)
        .where(and(inArray(Leases.deploymentId, usdcIds), isNull(Leases.closedHeight), eq(Leases.denom, "uact")));
      const leaseBalancesByDeployment = new Map<number, string[]>();
      for (const lease of usdcLeases) {
        leaseBalancesByDeployment.set(lease.deploymentId, [...(leaseBalancesByDeployment.get(lease.deploymentId) ?? []), lease.balance]);
      }
      for (const deployment of usdc) {
        const contribution = conversionBankContribution(
          { balance: deployment.balance, leaseBalances: leaseBalancesByDeployment.get(deployment.id) ?? [] },
          RATE_ONE
        );
        expectedBurned += contribution.burned;
        expectedMinted += contribution.minted;
      }
    }

    if (step.bankTotals.burnedUsdc !== expectedBurned || step.bankTotals.mintedUact !== expectedMinted) {
      this.#logger.warn({
        event: "ACT_MIGRATION_USDC_TOTALS_MISMATCH",
        height: step.height,
        expectedBurnedUsdc: expectedBurned.toString(),
        expectedMintedUact: expectedMinted.toString(),
        eventBurnedUsdc: step.bankTotals.burnedUsdc.toString(),
        eventMintedUact: step.bankTotals.mintedUact.toString()
      });
    }
  }

  async #persistLastPrice(tx: ChainTransaction, lastPrice: { price: string; height: number }): Promise<void> {
    await tx
      .insert(ActMigrationState)
      .values({ id: 1, lastAktUsdPrice: lastPrice.price, lastPriceHeight: lastPrice.height })
      .onConflictDoUpdate({
        target: ActMigrationState.id,
        set: { lastAktUsdPrice: lastPrice.price, lastPriceHeight: lastPrice.height },
        setWhere: sql`EXCLUDED.last_price_height >= ${ActMigrationState.lastPriceHeight}`
      });
  }

  async #claimMarker(tx: ChainTransaction, stream: string, height: number): Promise<boolean> {
    const claimed = await tx.insert(IndexerState).values({ stream, lastHeight: height, updatedAt: new Date() }).onConflictDoNothing().returning();
    return claimed.length > 0;
  }

  async #claimDrainedIfEmpty(tx: ChainTransaction, height: number, remainingCount: number): Promise<boolean> {
    if (remainingCount !== 0) {
      return false;
    }
    await this.#claimMarker(tx, ACT_MIGRATION_STREAMS.drained, height);
    return true;
  }

  /**
   * The markers are authoritative for the upgrade and drained states; the last oracle price
   * re-derives from the singleton state row, written in the same transactions as the blocks that
   * produced it, so a restart resumes mid-drain exactly where it left off.
   */
  async #ensureLoaded(): Promise<void> {
    if (this.#loaded) {
      return;
    }

    const markers = await this.#db
      .select({ stream: IndexerState.stream })
      .from(IndexerState)
      .where(inArray(IndexerState.stream, [ACT_MIGRATION_STREAMS.upgrade, ACT_MIGRATION_STREAMS.drained]));
    this.#upgradeApplied = markers.some(marker => marker.stream === ACT_MIGRATION_STREAMS.upgrade);
    this.#drained = markers.some(marker => marker.stream === ACT_MIGRATION_STREAMS.drained);

    if (!this.#drained) {
      if (this.#upgradeApplied) {
        const [{ remaining }] = await this.#db
          .select({ remaining: sql<number>`COUNT(*)::int` })
          .from(ActMigrationQueue)
          .where(isNull(ActMigrationQueue.convertedAtHeight));
        this.#drained = remaining === 0;
      }

      const [state] = await this.#db.select().from(ActMigrationState).where(eq(ActMigrationState.id, 1));
      this.#lastAktUsdPrice = state?.lastAktUsdPrice ?? null;
    }

    this.#loaded = true;
  }
}

/**
 * The chain seeds `pendingDenomMigrations` via `collections.Join(owner, dseq)`, iterating raw
 * AccAddress bytes then dseq. Bech32-string order does not reproduce that byte order — the bech32
 * charset is not ASCII-monotonic — so the drain queue is ordered by the decoded address bytes to
 * match the exact sequence the chain converts deployments in across drain blocks.
 */
function orderByChainDrainSequence<T extends { owner: string; dseq: string }>(deployments: T[]): T[] {
  return deployments
    .map(deployment => ({ deployment, ownerBytes: fromBech32(deployment.owner).data }))
    .sort((left, right) => compareBytes(left.ownerBytes, right.ownerBytes) || compareDseq(left.deployment.dseq, right.deployment.dseq))
    .map(entry => entry.deployment);
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return a.length - b.length;
}

/** Postgres normalizes numeric literals, so dseq order must compare numerically, matching the chain's uint64 key. */
function compareDseq(a: string, b: string): number {
  const left = BigInt(a);
  const right = BigInt(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
