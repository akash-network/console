import { desc, eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { NetworkRollups, NetworkState } from "@src/db/schema";
import type { GetNetworkStatsResponse, NetworkDay } from "@src/http-schemas/network-stats.schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

const SINGLETON_ID = 1;

/** Read side of the incremental aggregates: the singleton state row is the live picture, the rollups the closed days behind it. */
@singleton()
export class NetworkStatsService {
  readonly #db: ChainDatabase;

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async getStats({ days }: { days: number }): Promise<GetNetworkStatsResponse["data"] | null> {
    const [state] = await this.#db.select().from(NetworkState).where(eq(NetworkState.id, SINGLETON_ID));
    if (!state) {
      return null;
    }

    const rollups = days > 0 ? await this.#db.select().from(NetworkRollups).orderBy(desc(NetworkRollups.date)).limit(days) : [];

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
      daily: rollups.reverse().map(toNetworkDay)
    };
  }
}

function toNetworkDay(rollup: typeof NetworkRollups.$inferSelect): NetworkDay {
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
    dailyUsdSpent: rollup.dailyUsdSpent
  };
}
