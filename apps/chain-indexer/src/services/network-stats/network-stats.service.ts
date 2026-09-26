import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { decFromInt, decFromString, decMul, decQuo, decToFixedString } from "@src/akash/dec";
import { DailyPrices, NetworkRollups, NetworkState } from "@src/db/schema";
import type { GetNetworkStatsResponse, NetworkDay } from "@src/http-schemas/network-stats.schema";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

const SINGLETON_ID = 1;

const MICRO_UNITS_PER_TOKEN = decFromInt(1_000_000);

/** A day without an AKT price counts its stablecoin spend only, as the legacy indexer did with a missing day price. */
const DAY_USD_SPENT = sql`COALESCE(${NetworkRollups.dailyUsdSpent}, (${NetworkRollups.dailyUusdcSpent} + ${NetworkRollups.dailyUactSpent}) / 1000000)`;

const CUMULATIVE_USD_SPENT = sql<string>`CAST(SUM(${DAY_USD_SPENT}) OVER (ORDER BY ${NetworkRollups.date}) AS numeric(38, 18))`;

type NetworkStateRow = typeof NetworkState.$inferSelect;
type RollupWithUsd = typeof NetworkRollups.$inferSelect & { totalUsdSpent: string };

/** Read side of the incremental aggregates: the singleton state row is the live picture, the rollups the closed days behind it. */
@singleton()
export class NetworkStatsService {
  readonly #db: ChainDatabase;

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  /** One read-only snapshot, because the committer closes a day and advances the state in one transaction and the open day's spend is their difference. */
  async getStats({ days }: { days: number }): Promise<GetNetworkStatsResponse["data"] | null> {
    return this.#db.transaction(
      async tx => {
        const [state] = await tx.select().from(NetworkState).where(eq(NetworkState.id, SINGLETON_ID));
        if (!state) {
          return null;
        }

        const rollups = await this.#readRecentRollups(tx, Math.max(days, 1));
        const openDayAktPrice = await this.#readAktPrice(tx, state.lastAggregatedAt.toISOString().slice(0, 10));

        return {
          height: state.lastAggregatedHeight,
          datetime: state.lastAggregatedAt.toISOString(),
          activeLeaseCount: state.activeLeaseCount,
          totalLeaseCount: state.totalLeaseCount,
          activeProviderCount: state.activeProviderCount,
          active: {
            cpuUnits: state.activeCpuUnits,
            gpuUnits: state.activeGpuUnits,
            memoryBytes: state.activeMemoryBytes,
            ephemeralStorageBytes: state.activeEphemeralStorageBytes,
            persistentStorageBytes: state.activePersistentStorageBytes
          },
          totalSpent: { uakt: state.totalUaktSpent, uusdc: state.totalUusdcSpent, uact: state.totalUactSpent },
          totalUsdSpent: liveUsdSpent(state, rollups[0], openDayAktPrice),
          daily: rollups.slice(0, days).reverse().map(toNetworkDay)
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" }
    );
  }

  async #readRecentRollups(tx: ChainTransaction, limit: number): Promise<RollupWithUsd[]> {
    return tx
      .select({ ...getTableColumns(NetworkRollups), totalUsdSpent: CUMULATIVE_USD_SPENT })
      .from(NetworkRollups)
      .orderBy(desc(NetworkRollups.date))
      .limit(limit);
  }

  async #readAktPrice(tx: ChainTransaction, date: string): Promise<string | undefined> {
    const [row] = await tx
      .select({ price: DailyPrices.price })
      .from(DailyPrices)
      .where(and(eq(DailyPrices.denom, "uakt"), eq(DailyPrices.date, date)));
    return row?.price;
  }
}

function liveUsdSpent(state: NetworkStateRow, lastClosedDay: RollupWithUsd | undefined, openDayAktPrice: string | undefined): string {
  const openUakt = decFromString(state.totalUaktSpent) - decFromString(lastClosedDay?.totalUaktSpent ?? "0");
  const openStablecoins =
    decFromString(state.totalUusdcSpent) +
    decFromString(state.totalUactSpent) -
    decFromString(lastClosedDay?.totalUusdcSpent ?? "0") -
    decFromString(lastClosedDay?.totalUactSpent ?? "0");
  const openAktUsd = openDayAktPrice === undefined ? 0n : decMul(decQuo(openUakt, MICRO_UNITS_PER_TOKEN), decFromString(openDayAktPrice));
  const openUsd = openAktUsd + decQuo(openStablecoins, MICRO_UNITS_PER_TOKEN);
  return decToFixedString(decFromString(lastClosedDay?.totalUsdSpent ?? "0") + openUsd);
}

function toNetworkDay(rollup: RollupWithUsd): NetworkDay {
  return {
    date: rollup.date,
    closeHeight: rollup.closeHeight,
    activeLeaseCount: rollup.activeLeaseCount,
    totalLeaseCount: rollup.totalLeaseCount,
    dailyLeaseCount: rollup.dailyLeaseCount,
    activeProviderCount: rollup.activeProviderCount,
    active: {
      cpuUnits: rollup.activeCpuUnits,
      gpuUnits: rollup.activeGpuUnits,
      memoryBytes: rollup.activeMemoryBytes,
      ephemeralStorageBytes: rollup.activeEphemeralStorageBytes,
      persistentStorageBytes: rollup.activePersistentStorageBytes
    },
    totalSpent: { uakt: rollup.totalUaktSpent, uusdc: rollup.totalUusdcSpent, uact: rollup.totalUactSpent },
    dailySpent: { uakt: rollup.dailyUaktSpent, uusdc: rollup.dailyUusdcSpent, uact: rollup.dailyUactSpent },
    dailyUsdSpent: rollup.dailyUsdSpent,
    totalUsdSpent: rollup.totalUsdSpent
  };
}
