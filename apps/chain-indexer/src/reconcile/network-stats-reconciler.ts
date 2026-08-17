import { desc, eq, isNull, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { decFromString } from "@src/akash/dec";
import { IndexerState, Leases, NetworkRollups, NetworkState, Providers } from "@src/db/schema";
import { SYNC_STREAM } from "@src/pipeline/block-committer.service";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

const DEFAULT_ROLLUP_SAMPLE_SIZE = 5;

const TRACKED_SPEND_DENOMS = ["uakt", "uusdc", "uact"] as const;

interface LeaseAggregates {
  activeLeaseCount: number;
  totalLeaseCount: number;
  activeCpuUnits: number;
  activeGpuUnits: number;
  activeMemoryBytes: number;
  activeEphemeralStorageBytes: number;
  activePersistentStorageBytes: number;
}

interface Mismatch {
  scope: string;
  field: string;
  expected: string;
  actual: string;
}

/**
 * Proves the incremental network aggregates match a manual recomputation from the leases table,
 * inside one REPEATABLE READ snapshot so the comparison cannot straddle a commit. The current
 * `network_state` row is checked in full — counts, active resources, provider count, watermark vs
 * the sync checkpoint, and settlement-exact spend (Σ withdrawn + balance per denom). Sampled rollup
 * rows are re-derived at their `close_height` from lease created/closed heights; historical spend
 * and provider counts are not re-derivable from current rows and are covered by the current-state
 * checks instead.
 */
@singleton()
export class NetworkStatsReconciler {
  readonly #db: ChainDatabase;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#logger = logger;
    this.#logger.setContext("NETWORK_RECONCILE");
  }

  async reconcile({ rollupSampleSize = DEFAULT_ROLLUP_SAMPLE_SIZE }: { rollupSampleSize?: number } = {}): Promise<boolean> {
    const mismatches = await this.#db.transaction(async tx => this.#collectMismatches(tx, rollupSampleSize), {
      isolationLevel: "repeatable read",
      accessMode: "read only"
    });

    if (mismatches === undefined) {
      return false;
    }

    for (const mismatch of mismatches) {
      this.#logger.error({ event: "NETWORK_RECONCILE_MISMATCH", ...mismatch });
    }
    const ok = mismatches.length === 0;
    this.#logger[ok ? "info" : "error"]({ event: ok ? "NETWORK_RECONCILE_OK" : "NETWORK_RECONCILE_FAILED", mismatches: mismatches.length });
    return ok;
  }

  async #collectMismatches(tx: ChainTransaction, rollupSampleSize: number): Promise<Mismatch[] | undefined> {
    const [state] = await tx.select().from(NetworkState);
    if (!state) {
      const { totalLeaseCount } = await this.#leaseAggregates(tx);
      if (totalLeaseCount === 0) {
        this.#logger.info({ event: "NETWORK_RECONCILE_EMPTY" });
        return [];
      }
      this.#logger.error({ event: "NETWORK_RECONCILE_NO_STATE", totalLeaseCount });
      return undefined;
    }

    return [...(await this.#checkCurrentState(tx, state)), ...(await this.#checkSpends(tx, state)), ...(await this.#checkRollups(tx, rollupSampleSize))];
  }

  async #checkCurrentState(tx: ChainTransaction, state: typeof NetworkState.$inferSelect): Promise<Mismatch[]> {
    const mismatches: Mismatch[] = [];
    const recomputed = await this.#leaseAggregates(tx);

    for (const field of Object.keys(recomputed) as (keyof LeaseAggregates)[]) {
      if (state[field] !== recomputed[field]) {
        mismatches.push({ scope: "network_state", field, expected: String(recomputed[field]), actual: String(state[field]) });
      }
    }

    const [providerRow] = await tx
      .select({ value: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(Providers)
      .where(isNull(Providers.deletedHeight));
    if (state.activeProviderCount !== providerRow.value) {
      mismatches.push({ scope: "network_state", field: "activeProviderCount", expected: String(providerRow.value), actual: String(state.activeProviderCount) });
    }

    const [checkpoint] = await tx.select().from(IndexerState).where(eq(IndexerState.stream, SYNC_STREAM));
    if (checkpoint && checkpoint.lastHeight !== state.lastAggregatedHeight) {
      mismatches.push({
        scope: "network_state",
        field: "lastAggregatedHeight",
        expected: String(checkpoint.lastHeight),
        actual: String(state.lastAggregatedHeight)
      });
    }

    return mismatches;
  }

  async #checkSpends(tx: ChainTransaction, state: typeof NetworkState.$inferSelect): Promise<Mismatch[]> {
    const rows = await tx
      .select({ denom: Leases.denom, earned: sql<string>`SUM(${Leases.withdrawnAmount} + ${Leases.balance})` })
      .from(Leases)
      .groupBy(Leases.denom);
    const earnedByDenom = new Map(rows.map(row => [row.denom, decFromString(row.earned)]));

    const stateByDenom = {
      uakt: decFromString(state.totalUaktSpent),
      uusdc: decFromString(state.totalUusdcSpent),
      uact: decFromString(state.totalUactSpent)
    };

    const mismatches: Mismatch[] = [];
    for (const denom of TRACKED_SPEND_DENOMS) {
      const expected = earnedByDenom.get(denom) ?? 0n;
      if (stateByDenom[denom] !== expected) {
        mismatches.push({ scope: "network_state", field: `total_${denom}_spent`, expected: expected.toString(), actual: stateByDenom[denom].toString() });
      }
    }
    return mismatches;
  }

  async #checkRollups(tx: ChainTransaction, rollupSampleSize: number): Promise<Mismatch[]> {
    const rollups = await tx.select().from(NetworkRollups).orderBy(desc(NetworkRollups.date)).limit(rollupSampleSize);

    const mismatches: Mismatch[] = [];
    for (const rollup of rollups) {
      const recomputed = await this.#leaseAggregates(tx, rollup.closeHeight);
      for (const field of Object.keys(recomputed) as (keyof LeaseAggregates)[]) {
        if (rollup[field] !== recomputed[field]) {
          mismatches.push({ scope: `network_rollups:${rollup.date}`, field, expected: String(recomputed[field]), actual: String(rollup[field]) });
        }
      }
    }
    return mismatches;
  }

  async #leaseAggregates(tx: ChainTransaction, atHeight?: number): Promise<LeaseAggregates> {
    const active =
      atHeight === undefined
        ? sql`${Leases.closedHeight} IS NULL`
        : sql`${Leases.createdHeight} <= ${atHeight} AND (${Leases.closedHeight} IS NULL OR ${Leases.closedHeight} > ${atHeight})`;
    const created = atHeight === undefined ? sql`TRUE` : sql`${Leases.createdHeight} <= ${atHeight}`;

    const [row] = await tx
      .select({
        activeLeaseCount: sql<number>`COUNT(*) FILTER (WHERE ${active})`.mapWith(Number),
        totalLeaseCount: sql<number>`COUNT(*) FILTER (WHERE ${created})`.mapWith(Number),
        activeCpuUnits: sql<number>`COALESCE(SUM(${Leases.cpuUnits}) FILTER (WHERE ${active}), 0)`.mapWith(Number),
        activeGpuUnits: sql<number>`COALESCE(SUM(${Leases.gpuUnits}) FILTER (WHERE ${active}), 0)`.mapWith(Number),
        activeMemoryBytes: sql<number>`COALESCE(SUM(${Leases.memoryBytes}) FILTER (WHERE ${active}), 0)`.mapWith(Number),
        activeEphemeralStorageBytes: sql<number>`COALESCE(SUM(${Leases.ephemeralStorageBytes}) FILTER (WHERE ${active}), 0)`.mapWith(Number),
        activePersistentStorageBytes: sql<number>`COALESCE(SUM(${Leases.persistentStorageBytes}) FILTER (WHERE ${active}), 0)`.mapWith(Number)
      })
      .from(Leases);
    return row;
  }
}
