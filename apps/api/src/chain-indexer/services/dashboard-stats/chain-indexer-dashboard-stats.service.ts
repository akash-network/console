import { inject, singleton } from "tsyringe";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import type { ChainIndexerApiClient } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { CHAIN_INDEXER_API_CLIENT } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { CHAIN_INDEXER_CONFIG } from "@src/chain-indexer/providers/chain-indexer-config.provider";
import type { DashboardDataResponse } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";

type NetworkStats = Awaited<ReturnType<ChainIndexerApiClient["v1"]["getNetworkStats"]>>["data"];
type NetworkDay = NetworkStats["daily"][number];
type DashboardStats = DashboardDataResponse["now"];

const HOURS_24_MS = 24 * 60 * 60 * 1_000;

/** Enough closed days to always hold the close nearest to 24 hours before the latest block. */
const DAYS_TO_FETCH = 3;

const MICRO_UNITS_PER_TOKEN = 1_000_000;

/** Serves the legacy dashboard `now` and `compare` blocks from chain-indexer. */
@singleton()
export class ChainIndexerDashboardStatsService {
  readonly #api: ChainIndexerApiClient;
  readonly #config: ChainIndexerConfig;

  constructor(@inject(CHAIN_INDEXER_API_CLIENT) api: ChainIndexerApiClient, @inject(CHAIN_INDEXER_CONFIG) config: ChainIndexerConfig) {
    this.#api = api;
    this.#config = config;
  }

  async getDashboardData(): Promise<{ now: DashboardStats; compare: DashboardStats }> {
    const { data } = await this.#api.v1.getNetworkStats(
      { days: DAYS_TO_FETCH },
      { signal: AbortSignal.timeout(this.#config.CHAIN_INDEXER_REQUEST_TIMEOUT_MS) }
    );
    const compareDay = pickDayClosestTo24HoursBefore(new Date(data.datetime), data.daily);
    const compare = compareDay ? dayStats(compareDay, dayBefore(compareDay, data.daily)) : liveStatsWithoutDeltas(data);
    return { now: liveStats(data, compare), compare };
  }
}

/** The legacy compare point was the first block after "latest minus 24 hours"; chain-indexer keeps day closes, so the nearest one stands in. */
function pickDayClosestTo24HoursBefore(latest: Date, days: NetworkDay[]): NetworkDay | undefined {
  const target = latest.getTime() - HOURS_24_MS;
  return days.reduce<NetworkDay | undefined>((best, day) => (best === undefined || distance(day, target) < distance(best, target) ? day : best), undefined);
}

function dayBefore(day: NetworkDay, days: NetworkDay[]): NetworkDay | undefined {
  return days.reduce<NetworkDay | undefined>(
    (latest, candidate) => (candidate.date < day.date && (!latest || candidate.date > latest.date) ? candidate : latest),
    undefined
  );
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
  const totalUUsdSpent = microUnits(data.totalUsdSpent);
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
    totalUUsdSpent,
    dailyUUsdSpent: totalUUsdSpent - compare.totalUUsdSpent,
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
    ...liveStats(data, {
      totalLeaseCount: data.totalLeaseCount,
      totalUAktSpent,
      totalUActSpent,
      totalUUsdcSpent: totalUActSpent,
      totalUUsdSpent: microUnits(data.totalUsdSpent)
    } as DashboardStats),
    dailyLeaseCount: 0,
    dailyUAktSpent: 0,
    dailyUActSpent: 0,
    dailyUUsdcSpent: 0,
    dailyUUsdSpent: 0
  };
}

/** Daily USD comes from consecutive cumulative totals, since `dailyUsdSpent` is null for a day without an AKT price while its cumulative still counts the stablecoin spend. */
function dayStats(day: NetworkDay, previousDay: NetworkDay | undefined): DashboardStats {
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
    totalUUsdSpent: microUnits(day.totalUsdSpent),
    dailyUUsdSpent: previousDay ? microUnits(day.totalUsdSpent) - microUnits(previousDay.totalUsdSpent) : microUnits(day.dailyUsdSpent ?? "0"),
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

function microUnits(amount: string): number {
  return Math.round(Number(amount) * MICRO_UNITS_PER_TOKEN);
}
