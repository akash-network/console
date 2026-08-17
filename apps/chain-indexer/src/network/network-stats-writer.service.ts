import { and, count, desc, eq, isNull, lte } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { decFromString, decToString } from "@src/akash/dec";
import type { NetworkBlockDelta } from "@src/akash/network-delta";
import { NetworkRollups, NetworkState, Providers } from "@src/db/schema";
import { DayCloseUsdService } from "@src/network/day-close-usd.service";
import type { ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

export interface NetworkBlockRef {
  height: number;
  datetime: Date;
}

interface RunningNetworkState {
  lastAggregatedHeight: number;
  lastAggregatedAt: Date;
  activeLeaseCount: number;
  totalLeaseCount: number;
  activeProviderCount: number;
  activeCpuUnits: number;
  activeGpuUnits: number;
  activeMemoryBytes: number;
  activeEphemeralStorageBytes: number;
  activePersistentStorageBytes: number;
  totalUaktSpent: bigint;
  totalUusdcSpent: bigint;
  totalUactSpent: bigint;
}

const SINGLETON_ID = 1;

const SPENT_FIELD_BY_DENOM = {
  uakt: "totalUaktSpent",
  uusdc: "totalUusdcSpent",
  uact: "totalUactSpent"
} as const;

function utcDay(datetime: Date): string {
  return datetime.toISOString().slice(0, 10);
}

/**
 * Maintains the singleton current-network-state row and the append-only daily rollups inside the
 * block transaction, from the per-block deltas the akash writer measured across its reducer fold.
 * The row is locked FOR UPDATE and `last_aggregated_height` is the replay watermark, so duplicate
 * commits and overlapping writers fold each block exactly once. A UTC day is closed atomically with
 * the first block of the following day; the closed day's USD is filled immediately when its price is
 * already known (backfill), and otherwise later by the price job via DayCloseUsdService.
 */
@singleton()
export class NetworkStatsWriter {
  readonly #dayCloseUsd: DayCloseUsdService;
  readonly #logger: LoggerService;

  constructor(@inject(DayCloseUsdService) dayCloseUsd: DayCloseUsdService, @inject(LoggerService) logger: LoggerService) {
    this.#dayCloseUsd = dayCloseUsd;
    this.#logger = logger;
    this.#logger.setContext("NETWORK_STATS");
  }

  async write(tx: ChainTransaction, blocks: NetworkBlockRef[], deltas: NetworkBlockDelta[]): Promise<void> {
    if (blocks.length === 0) {
      return;
    }

    await this.#ensureStateRow(tx, blocks[0]);
    const state = await this.#lockState(tx);
    const deltaByHeight = new Map(deltas.map(delta => [delta.height, delta]));

    let aggregated = false;
    for (const block of blocks) {
      if (block.height <= state.lastAggregatedHeight) {
        continue;
      }
      if (utcDay(block.datetime) > utcDay(state.lastAggregatedAt)) {
        await this.#closeDay(tx, state);
      }
      const delta = deltaByHeight.get(block.height);
      if (delta) {
        this.#applyDelta(state, delta);
      }
      state.lastAggregatedHeight = block.height;
      state.lastAggregatedAt = block.datetime;
      aggregated = true;
    }

    if (!aggregated) {
      return;
    }

    state.activeProviderCount = await this.#countProviders(tx);
    await this.#flushState(tx, state);
  }

  async #ensureStateRow(tx: ChainTransaction, firstBlock: NetworkBlockRef): Promise<void> {
    await tx
      .insert(NetworkState)
      .values({ id: SINGLETON_ID, lastAggregatedHeight: firstBlock.height - 1, lastAggregatedAt: firstBlock.datetime })
      .onConflictDoNothing();
  }

  async #lockState(tx: ChainTransaction): Promise<RunningNetworkState> {
    const [row] = await tx.select().from(NetworkState).where(eq(NetworkState.id, SINGLETON_ID)).for("update");
    return {
      lastAggregatedHeight: row.lastAggregatedHeight,
      lastAggregatedAt: row.lastAggregatedAt,
      activeLeaseCount: row.activeLeaseCount,
      totalLeaseCount: row.totalLeaseCount,
      activeProviderCount: row.activeProviderCount,
      activeCpuUnits: row.activeCpuUnits,
      activeGpuUnits: row.activeGpuUnits,
      activeMemoryBytes: row.activeMemoryBytes,
      activeEphemeralStorageBytes: row.activeEphemeralStorageBytes,
      activePersistentStorageBytes: row.activePersistentStorageBytes,
      totalUaktSpent: decFromString(row.totalUaktSpent),
      totalUusdcSpent: decFromString(row.totalUusdcSpent),
      totalUactSpent: decFromString(row.totalUactSpent)
    };
  }

  #applyDelta(state: RunningNetworkState, delta: NetworkBlockDelta): void {
    state.activeLeaseCount += delta.activeLeaseDelta;
    state.totalLeaseCount += delta.leasesCreated;
    state.activeCpuUnits += delta.cpuUnitsDelta;
    state.activeGpuUnits += delta.gpuUnitsDelta;
    state.activeMemoryBytes += delta.memoryBytesDelta;
    state.activeEphemeralStorageBytes += delta.ephemeralStorageBytesDelta;
    state.activePersistentStorageBytes += delta.persistentStorageBytesDelta;

    for (const [denom, earned] of delta.earnedDeltaByDenom) {
      const field = SPENT_FIELD_BY_DENOM[denom as keyof typeof SPENT_FIELD_BY_DENOM];
      if (!field) {
        this.#logger.warn({ event: "NETWORK_STATS_UNKNOWN_SPEND_DENOM", denom, height: delta.height, earned: decToString(earned) });
        continue;
      }
      state[field] += earned;
    }
  }

  /** The closing day's snapshot is the state as of the last aggregated block, which may belong to a previous batch. */
  async #closeDay(tx: ChainTransaction, state: RunningNetworkState): Promise<void> {
    const date = utcDay(state.lastAggregatedAt);
    const [previous] = await tx.select().from(NetworkRollups).orderBy(desc(NetworkRollups.date)).limit(1);
    const previousTotals = {
      totalLeaseCount: previous?.totalLeaseCount ?? 0,
      totalUaktSpent: previous ? decFromString(previous.totalUaktSpent) : 0n,
      totalUusdcSpent: previous ? decFromString(previous.totalUusdcSpent) : 0n,
      totalUactSpent: previous ? decFromString(previous.totalUactSpent) : 0n
    };

    await tx
      .insert(NetworkRollups)
      .values({
        date,
        closeHeight: state.lastAggregatedHeight,
        closeAt: state.lastAggregatedAt,
        activeLeaseCount: state.activeLeaseCount,
        totalLeaseCount: state.totalLeaseCount,
        dailyLeaseCount: state.totalLeaseCount - previousTotals.totalLeaseCount,
        activeProviderCount: await this.#countProviders(tx, state.lastAggregatedHeight),
        activeCpuUnits: state.activeCpuUnits,
        activeGpuUnits: state.activeGpuUnits,
        activeMemoryBytes: state.activeMemoryBytes,
        activeEphemeralStorageBytes: state.activeEphemeralStorageBytes,
        activePersistentStorageBytes: state.activePersistentStorageBytes,
        totalUaktSpent: decToString(state.totalUaktSpent),
        totalUusdcSpent: decToString(state.totalUusdcSpent),
        totalUactSpent: decToString(state.totalUactSpent),
        dailyUaktSpent: decToString(state.totalUaktSpent - previousTotals.totalUaktSpent),
        dailyUusdcSpent: decToString(state.totalUusdcSpent - previousTotals.totalUusdcSpent),
        dailyUactSpent: decToString(state.totalUactSpent - previousTotals.totalUactSpent)
      })
      .onConflictDoNothing();

    await this.#dayCloseUsd.recompute(tx, date);
  }

  async #countProviders(tx: ChainTransaction, atHeight?: number): Promise<number> {
    const [row] = await tx
      .select({ value: count() })
      .from(Providers)
      .where(atHeight === undefined ? isNull(Providers.deletedHeight) : and(isNull(Providers.deletedHeight), lte(Providers.createdHeight, atHeight)));
    return row.value;
  }

  async #flushState(tx: ChainTransaction, state: RunningNetworkState): Promise<void> {
    await tx
      .update(NetworkState)
      .set({
        lastAggregatedHeight: state.lastAggregatedHeight,
        lastAggregatedAt: state.lastAggregatedAt,
        activeLeaseCount: state.activeLeaseCount,
        totalLeaseCount: state.totalLeaseCount,
        activeProviderCount: state.activeProviderCount,
        activeCpuUnits: state.activeCpuUnits,
        activeGpuUnits: state.activeGpuUnits,
        activeMemoryBytes: state.activeMemoryBytes,
        activeEphemeralStorageBytes: state.activeEphemeralStorageBytes,
        activePersistentStorageBytes: state.activePersistentStorageBytes,
        totalUaktSpent: decToString(state.totalUaktSpent),
        totalUusdcSpent: decToString(state.totalUusdcSpent),
        totalUactSpent: decToString(state.totalUactSpent)
      })
      .where(eq(NetworkState.id, SINGLETON_ID));
  }
}
