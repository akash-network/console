import { inject, singleton } from "tsyringe";

import type { ChainIndexerApiClient } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { CHAIN_INDEXER_API_CLIENT } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import type { DashboardDataResponse } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";

type NetworkStats = Awaited<ReturnType<ChainIndexerApiClient["v1"]["getNetworkStats"]>>["data"];
type NetworkDay = NetworkStats["daily"][number];
type DashboardStats = DashboardDataResponse["now"];

const HOURS_24_MS = 24 * 60 * 60 * 1_000;

/** Enough closed days to always hold the close nearest to 24 hours before the latest block. */
const DAYS_TO_FETCH = 3;

/** Serves the legacy dashboard `now` and `compare` blocks from chain-indexer; USD totals are not exposed there yet and come back as zero. */
@singleton()
export class ChainIndexerDashboardStatsService {
  readonly #api: ChainIndexerApiClient;

  constructor(@inject(CHAIN_INDEXER_API_CLIENT) api: ChainIndexerApiClient) {
    this.#api = api;
  }

  async getDashboardData(): Promise<{ now: DashboardStats; compare: DashboardStats }> {
    const { data } = await this.#api.v1.getNetworkStats({ days: DAYS_TO_FETCH });
    const compareDay = pickDayClosestTo24HoursBefore(new Date(data.datetime), data.daily);
    const compare = compareDay ? dayStats(compareDay) : liveStatsWithoutDeltas(data);
    return { now: liveStats(data, compare), compare };
  }
}

/** The legacy compare point was the first block after "latest minus 24 hours"; chain-indexer keeps day closes, so the nearest one stands in. */
function pickDayClosestTo24HoursBefore(latest: Date, days: NetworkDay[]): NetworkDay | undefined {
  const target = latest.getTime() - HOURS_24_MS;
  return days.reduce<NetworkDay | undefined>((best, day) => (best === undefined || distance(day, target) < distance(best, target) ? day : best), undefined);
}

function distance(day: NetworkDay, target: number): number {
  return Math.abs(closeTime(day).getTime() - target);
}

function closeTime(day: NetworkDay): Date {
  return new Date(new Date(`${day.date}T00:00:00.000Z`).getTime() + HOURS_24_MS);
}

function liveStats(data: NetworkStats, compare: DashboardStats): DashboardStats {
  const totalUAktSpent = wholeUnits(data.totalSpent.uakt);
  const totalUActSpent = combinedActSpent(data.totalSpent);
  return {
    date: data.datetime,
    height: data.height,
    activeLeaseCount: data.activeLeaseCount,
    totalLeaseCount: data.totalLeaseCount,
    dailyLeaseCount: data.totalLeaseCount - compare.totalLeaseCount,
    totalUAktSpent,
    dailyUAktSpent: totalUAktSpent - compare.totalUAktSpent,
    totalUActSpent,
    dailyUActSpent: totalUActSpent - compare.totalUActSpent,
    totalUUsdcSpent: totalUActSpent,
    dailyUUsdcSpent: totalUActSpent - compare.totalUUsdcSpent,
    totalUUsdSpent: 0,
    dailyUUsdSpent: 0,
    activeCPU: data.active.cpuUnits,
    activeGPU: data.active.gpuUnits,
    activeMemory: data.active.memoryBytes,
    activeStorage: data.active.ephemeralStorageBytes + data.active.persistentStorageBytes
  };
}

function liveStatsWithoutDeltas(data: NetworkStats): DashboardStats {
  const totalUAktSpent = wholeUnits(data.totalSpent.uakt);
  const totalUActSpent = combinedActSpent(data.totalSpent);
  return {
    ...liveStats(data, { totalLeaseCount: data.totalLeaseCount, totalUAktSpent, totalUActSpent, totalUUsdcSpent: totalUActSpent } as DashboardStats),
    dailyLeaseCount: 0,
    dailyUAktSpent: 0,
    dailyUActSpent: 0,
    dailyUUsdcSpent: 0
  };
}

function dayStats(day: NetworkDay): DashboardStats {
  return {
    date: closeTime(day).toISOString(),
    height: day.closeHeight,
    activeLeaseCount: day.activeLeaseCount,
    totalLeaseCount: day.totalLeaseCount,
    dailyLeaseCount: day.dailyLeaseCount,
    totalUAktSpent: wholeUnits(day.totalSpent.uakt),
    dailyUAktSpent: wholeUnits(day.dailySpent.uakt),
    totalUActSpent: combinedActSpent(day.totalSpent),
    dailyUActSpent: combinedActSpent(day.dailySpent),
    totalUUsdcSpent: combinedActSpent(day.totalSpent),
    dailyUUsdcSpent: combinedActSpent(day.dailySpent),
    totalUUsdSpent: 0,
    dailyUUsdSpent: 0,
    activeCPU: day.active.cpuUnits,
    activeGPU: day.active.gpuUnits,
    activeMemory: day.active.memoryBytes,
    activeStorage: day.active.ephemeralStorageBytes + day.active.persistentStorageBytes
  };
}

/** The legacy dashboard reports USDC and ACT spend as one figure since ACT replaced USDC. */
function combinedActSpent(spent: { uusdc: string; uact: string }): number {
  return wholeUnits(spent.uusdc) + wholeUnits(spent.uact);
}

function wholeUnits(amount: string): number {
  return Math.floor(Number(amount));
}
