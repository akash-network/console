import { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { CosmosHttpService } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { differenceInSeconds, minutesToSeconds, subHours } from "date-fns";
import uniqBy from "lodash/uniqBy";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { BmeDashboardDataResponse, BmePeriodData } from "@src/dashboard/http-schemas/bme-dashboard-data/bme-dashboard-data.schema";
import { BmeStatusHistoryResponse } from "@src/dashboard/http-schemas/bme-status-history/bme-status-history.schema";
import { GraphDataResponse } from "@src/dashboard/http-schemas/graph-data/graph-data.schema";
import { LeasesDurationParams, LeasesDurationQuery, LeasesDurationResponse } from "@src/dashboard/http-schemas/leases-duration/leases-duration.schema";
import { MarketDataParams } from "@src/dashboard/http-schemas/market-data/market-data.schema";
import { StatsRepository } from "@src/dashboard/repositories/stats";
import { ProviderCapacityStats, StatsItem } from "@src/types/provider";
import { forEachInChunks } from "@src/utils/array/array";
import { createLoggingExecutor } from "@src/utils/logging";
import type { AuthorizedGraphDataName, DashboardGraphDataName } from "./stats.types";

const numberOrZero: (x: number | undefined | null) => number = (x: number | undefined | null) => (typeof x === "number" ? x : 0);

const combinedActSpent = (b: { totalUUsdcSpent?: number | null; totalUActSpent?: number | null }) =>
  numberOrZero(b.totalUUsdcSpent) + numberOrZero(b.totalUActSpent);

const logger = createOtelLogger({ context: "StatsService" });
const runOrLog = createLoggingExecutor(logger);

type DateValue = { date: Date; value: number };

type BlockMetricConfig = {
  attributes: (keyof Block)[];
  getter: (block: Block) => number;
  isRelative?: boolean;
  dashboardKey?: DashboardGraphDataName;
  bmeDashboardKey?: Exclude<keyof BmePeriodData, "date">;
  requireBme?: boolean;
};

export const emptyNetworkCapacity = {
  activeProviderCount: 0,
  activeCPU: 0,
  activeGPU: 0,
  activeMemory: 0,
  activeStorage: 0,
  pendingCPU: 0,
  pendingGPU: 0,
  pendingMemory: 0,
  pendingStorage: 0,
  availableCPU: 0,
  availableGPU: 0,
  availableMemory: 0,
  availableStorage: 0,
  totalCPU: 0,
  totalGPU: 0,
  totalMemory: 0,
  totalStorage: 0,
  activeEphemeralStorage: 0,
  pendingEphemeralStorage: 0,
  availableEphemeralStorage: 0,
  activePersistentStorage: 0,
  pendingPersistentStorage: 0,
  availablePersistentStorage: 0,
  totalEphemeralStorage: 0,
  totalPersistentStorage: 0
};

const blockMetrics: Partial<Record<AuthorizedGraphDataName, BlockMetricConfig>> = {
  dailyUAktSpent: { attributes: ["totalUAktSpent"], getter: b => numberOrZero(b.totalUAktSpent), dashboardKey: "dailyUAktSpent", isRelative: true },
  dailyUActSpent: { attributes: ["totalUUsdcSpent", "totalUActSpent"], getter: combinedActSpent, dashboardKey: "dailyUActSpent", isRelative: true },
  dailyUUsdcSpent: { attributes: ["totalUUsdcSpent", "totalUActSpent"], getter: combinedActSpent, dashboardKey: "dailyUUsdcSpent", isRelative: true },
  dailyUUsdSpent: { attributes: ["totalUUsdSpent"], getter: b => numberOrZero(b.totalUUsdSpent), dashboardKey: "dailyUUsdSpent", isRelative: true },
  dailyLeaseCount: { attributes: ["totalLeaseCount"], getter: b => numberOrZero(b.totalLeaseCount), dashboardKey: "dailyLeaseCount", isRelative: true },
  activeStorage: {
    attributes: ["activeEphemeralStorage", "activePersistentStorage"],
    getter: b => numberOrZero(b.activeEphemeralStorage) + numberOrZero(b.activePersistentStorage),
    dashboardKey: "activeStorage"
  },
  totalUAktSpent: { attributes: ["totalUAktSpent"], getter: b => numberOrZero(b.totalUAktSpent), dashboardKey: "totalUAktSpent" },
  totalUActSpent: { attributes: ["totalUUsdcSpent", "totalUActSpent"], getter: combinedActSpent, dashboardKey: "totalUActSpent" },
  totalUUsdcSpent: { attributes: ["totalUUsdcSpent", "totalUActSpent"], getter: combinedActSpent, dashboardKey: "totalUUsdcSpent" },
  totalUUsdSpent: { attributes: ["totalUUsdSpent"], getter: b => numberOrZero(b.totalUUsdSpent), dashboardKey: "totalUUsdSpent" },
  activeLeaseCount: { attributes: ["activeLeaseCount"], getter: b => numberOrZero(b.activeLeaseCount), dashboardKey: "activeLeaseCount" },
  totalLeaseCount: { attributes: ["totalLeaseCount"], getter: b => numberOrZero(b.totalLeaseCount), dashboardKey: "totalLeaseCount" },
  activeCPU: { attributes: ["activeCPU"], getter: b => numberOrZero(b.activeCPU), dashboardKey: "activeCPU" },
  activeGPU: { attributes: ["activeGPU"], getter: b => numberOrZero(b.activeGPU), dashboardKey: "activeGPU" },
  activeMemory: { attributes: ["activeMemory"], getter: b => numberOrZero(b.activeMemory), dashboardKey: "activeMemory" },
  totalAktBurnedForAct: {
    attributes: ["totalUaktBurnedForUact"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact),
    requireBme: true,
    bmeDashboardKey: "totalAktBurnedForAct"
  },
  dailyAktBurnedForAct: {
    attributes: ["totalUaktBurnedForUact"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact),
    isRelative: true,
    requireBme: true,
    bmeDashboardKey: "dailyAktBurnedForAct"
  },
  totalActMinted: { attributes: ["totalUactMinted"], getter: b => numberOrZero(b.totalUactMinted), requireBme: true, bmeDashboardKey: "totalActMinted" },
  dailyActMinted: {
    attributes: ["totalUactMinted"],
    getter: b => numberOrZero(b.totalUactMinted),
    isRelative: true,
    requireBme: true,
    bmeDashboardKey: "dailyActMinted"
  },
  totalActBurnedForAkt: {
    attributes: ["totalUactBurnedForUakt"],
    getter: b => numberOrZero(b.totalUactBurnedForUakt),
    requireBme: true,
    bmeDashboardKey: "totalActBurnedForAkt"
  },
  dailyActBurnedForAkt: {
    attributes: ["totalUactBurnedForUakt"],
    getter: b => numberOrZero(b.totalUactBurnedForUakt),
    isRelative: true,
    requireBme: true,
    bmeDashboardKey: "dailyActBurnedForAkt"
  },
  totalAktReminted: {
    attributes: ["totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktReminted),
    requireBme: true,
    bmeDashboardKey: "totalAktReminted"
  },
  dailyAktReminted: {
    attributes: ["totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktReminted),
    isRelative: true,
    requireBme: true,
    bmeDashboardKey: "dailyAktReminted"
  },
  netAktBurned: {
    attributes: ["totalUaktBurnedForUact", "totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact) - numberOrZero(b.totalUaktReminted),
    requireBme: true,
    bmeDashboardKey: "netAktBurned"
  },
  dailyNetAktBurned: {
    attributes: ["totalUaktBurnedForUact", "totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact) - numberOrZero(b.totalUaktReminted),
    isRelative: true,
    requireBme: true,
    bmeDashboardKey: "dailyNetAktBurned"
  },
  outstandingAct: { attributes: ["outstandingUact"], getter: b => numberOrZero(b.outstandingUact), requireBme: true, bmeDashboardKey: "outstandingAct" },
  vaultAkt: { attributes: ["vaultUakt"], getter: b => numberOrZero(b.vaultUakt), requireBme: true, bmeDashboardKey: "vaultAkt" }
};

@singleton()
export class StatsService {
  constructor(
    private readonly statsRepository: StatsRepository,
    private readonly cosmosHttpService: CosmosHttpService,
    private readonly denomExchangeService: DenomExchangeService
  ) {}

  async getDashboardData() {
    const latestBlockStats = await this.statsRepository.findLatestProcessedBlock();
    if (!latestBlockStats) {
      throw new Error("No blocks stats found");
    }

    const compareDate = subHours(latestBlockStats.datetime, 24);
    const compareBlockStats = await this.statsRepository.findFirstBlockSince(compareDate);
    if (!compareBlockStats) {
      throw new Error(`No block found since ${compareDate.toISOString()}`);
    }

    const secondCompareDate = subHours(latestBlockStats.datetime, 48);
    const secondCompareBlockStats = await this.statsRepository.findFirstBlockSince(secondCompareDate);
    if (!secondCompareBlockStats) {
      throw new Error(`No block found since ${secondCompareDate.toISOString()}`);
    }

    return {
      now: {
        date: latestBlockStats.datetime.toISOString(),
        height: latestBlockStats.height,
        activeLeaseCount: latestBlockStats.activeLeaseCount ?? 0,
        totalLeaseCount: latestBlockStats.totalLeaseCount ?? 0,
        dailyLeaseCount: numberOrZero(latestBlockStats.totalLeaseCount) - numberOrZero(compareBlockStats?.totalLeaseCount),
        totalUAktSpent: latestBlockStats.totalUAktSpent ?? 0,
        dailyUAktSpent: numberOrZero(latestBlockStats.totalUAktSpent) - numberOrZero(compareBlockStats?.totalUAktSpent),
        totalUActSpent: combinedActSpent(latestBlockStats),
        dailyUActSpent: combinedActSpent(latestBlockStats) - combinedActSpent(compareBlockStats ?? {}),
        totalUUsdcSpent: combinedActSpent(latestBlockStats),
        dailyUUsdcSpent: combinedActSpent(latestBlockStats) - combinedActSpent(compareBlockStats ?? {}),
        totalUUsdSpent: latestBlockStats.totalUUsdSpent ?? 0,
        dailyUUsdSpent: numberOrZero(latestBlockStats.totalUUsdSpent) - numberOrZero(compareBlockStats?.totalUUsdSpent),
        activeCPU: latestBlockStats.activeCPU ?? 0,
        activeGPU: latestBlockStats.activeGPU ?? 0,
        activeMemory: latestBlockStats.activeMemory ?? 0,
        activeStorage: numberOrZero(latestBlockStats.activeEphemeralStorage) + numberOrZero(latestBlockStats.activePersistentStorage)
      },
      compare: {
        date: compareBlockStats.datetime.toISOString(),
        height: compareBlockStats.height,
        activeLeaseCount: compareBlockStats.activeLeaseCount ?? 0,
        totalLeaseCount: compareBlockStats.totalLeaseCount ?? 0,
        dailyLeaseCount: numberOrZero(compareBlockStats.totalLeaseCount) - numberOrZero(secondCompareBlockStats.totalLeaseCount),
        totalUAktSpent: compareBlockStats.totalUAktSpent ?? 0,
        dailyUAktSpent: numberOrZero(compareBlockStats.totalUAktSpent) - numberOrZero(secondCompareBlockStats.totalUAktSpent),
        totalUActSpent: combinedActSpent(compareBlockStats),
        dailyUActSpent: combinedActSpent(compareBlockStats) - combinedActSpent(secondCompareBlockStats),
        totalUUsdcSpent: combinedActSpent(compareBlockStats),
        dailyUUsdcSpent: combinedActSpent(compareBlockStats) - combinedActSpent(secondCompareBlockStats),
        totalUUsdSpent: compareBlockStats.totalUUsdSpent ?? 0,
        dailyUUsdSpent: numberOrZero(compareBlockStats.totalUUsdSpent) - numberOrZero(secondCompareBlockStats.totalUUsdSpent),
        activeCPU: compareBlockStats.activeCPU ?? 0,
        activeGPU: compareBlockStats.activeGPU ?? 0,
        activeMemory: compareBlockStats.activeMemory ?? 0,
        activeStorage: numberOrZero(compareBlockStats.activeEphemeralStorage) + numberOrZero(compareBlockStats.activePersistentStorage)
      }
    };
  }

  async getGraphData(dataName: AuthorizedGraphDataName): Promise<GraphDataResponse> {
    switch (dataName) {
      case "gpuUtilization":
        return this.getGpuUtilization();
      case "collateralRatio":
        return this.getCollateralRatio();
      default:
        return this.getBlockGraphData(dataName);
    }
  }

  private async getBlockGraphData(dataName: Exclude<AuthorizedGraphDataName, "gpuUtilization" | "collateralRatio">): Promise<GraphDataResponse> {
    const config = blockMetrics[dataName];
    if (!config) {
      throw new Error(`Unknown graph data name: ${dataName}`);
    }

    let stats = await this.fetchDailyBlockSnapshots(config.attributes, config.getter, config.requireBme);

    if (dataName === "activeGPU") {
      stats = stripLeadingZeros(stats);
    }

    if (config.isRelative) {
      stats = toRelativeValues(stats);
    }

    return this.buildGraphDataResponse(stats, { dashboardKey: config.dashboardKey, bmeDashboardKey: config.bmeDashboardKey });
  }

  private async fetchDailyBlockSnapshots(attributes: (keyof Block)[], getter: (block: Block) => number, requireBme?: boolean): Promise<DateValue[]> {
    const [result, latestBlock] = await Promise.all([
      this.statsRepository.findDailyBlockSnapshots(attributes, { requireBme }),
      this.statsRepository.findLatestBlockWithAttributes(attributes, { requireBme })
    ]);

    const stats = result.map(day => ({
      date: day.date,
      value: getter(day.lastBlock!)
    }));

    if (latestBlock) {
      const blockDateStr = latestBlock.datetime.toISOString().slice(0, 10);
      const lastSnapshotDateStr = stats.length > 0 ? new Date(stats[stats.length - 1].date).toISOString().slice(0, 10) : null;

      if (!lastSnapshotDateStr || blockDateStr > lastSnapshotDateStr) {
        stats.push({ date: latestBlock.datetime, value: getter(latestBlock) });
      }
    }

    return stats;
  }

  private async buildGraphDataResponse(
    stats: DateValue[],
    options?: { dashboardKey?: DashboardGraphDataName; bmeDashboardKey?: Exclude<keyof BmePeriodData, "date"> }
  ): Promise<GraphDataResponse> {
    if (options?.dashboardKey) {
      const dashboardData = await this.getDashboardData();

      return {
        currentValue: numberOrZero(dashboardData.now[options.dashboardKey]),
        compareValue: numberOrZero(dashboardData.compare[options.dashboardKey]),
        snapshots: stats
      };
    }

    if (options?.bmeDashboardKey) {
      const bmeDashboardData = await this.getBmeDashboardData();

      return {
        currentValue: bmeDashboardData.now[options.bmeDashboardKey],
        compareValue: bmeDashboardData.compare[options.bmeDashboardKey],
        snapshots: stats
      };
    }

    return {
      currentValue: stats[stats.length - 1]?.value ?? 0,
      compareValue: stats[stats.length - 2]?.value ?? 0,
      snapshots: stats
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getGpuUtilization() {
    const result = await this.statsRepository.findGpuUtilization();

    const stats = result.map(day => ({
      date: day.date,
      value: day.gpuUtilization
    }));

    return {
      currentValue: stats[stats.length - 1]?.value ?? 0,
      compareValue: stats[stats.length - 2]?.value ?? 0,
      snapshots: stats
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getCollateralRatio() {
    const result = await this.statsRepository.findCollateralRatio();

    const stats = result.map(day => ({
      date: day.date,
      value: day.collateralRatio
    }));

    const bmeDashboardData = await this.getBmeDashboardData();

    return {
      currentValue: bmeDashboardData.now.collateralRatio,
      compareValue: stats[stats.length - 2]?.value ?? 0,
      snapshots: stats
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getBmeDashboardData(): Promise<BmeDashboardDataResponse> {
    const { now, compare, secondCompare } = await this.statsRepository.findBmeDashboardData();

    let collateralRatio = now.collateralRatio;

    if (collateralRatio === 0 && now.outstandingUact > 0 && now.vaultUakt > 0) {
      const aktPrice = await this.getAktPrice();

      if (aktPrice > 0) {
        collateralRatio = parseFloat(((now.vaultUakt * aktPrice) / now.outstandingUact).toFixed(6));
      }
    }

    const daily = (total: number, prevTotal: number) => total - prevTotal;

    return {
      now: {
        date: now.datetime.toISOString(),
        outstandingAct: now.outstandingUact,
        vaultAkt: now.vaultUakt,
        collateralRatio,
        totalAktBurnedForAct: now.totalUaktBurnedForUact,
        dailyAktBurnedForAct: daily(now.totalUaktBurnedForUact, compare.totalUaktBurnedForUact),
        totalActMinted: now.totalUactMinted,
        dailyActMinted: daily(now.totalUactMinted, compare.totalUactMinted),
        totalActBurnedForAkt: now.totalUactBurnedForUakt,
        dailyActBurnedForAkt: daily(now.totalUactBurnedForUakt, compare.totalUactBurnedForUakt),
        totalAktReminted: now.totalUaktReminted,
        dailyAktReminted: daily(now.totalUaktReminted, compare.totalUaktReminted),
        netAktBurned: now.totalUaktBurnedForUact - now.totalUaktReminted,
        dailyNetAktBurned: daily(now.totalUaktBurnedForUact - now.totalUaktReminted, compare.totalUaktBurnedForUact - compare.totalUaktReminted)
      },
      compare: {
        date: compare.datetime.toISOString(),
        outstandingAct: compare.outstandingUact,
        vaultAkt: compare.vaultUakt,
        collateralRatio: compare.collateralRatio,
        totalAktBurnedForAct: compare.totalUaktBurnedForUact,
        dailyAktBurnedForAct: daily(compare.totalUaktBurnedForUact, secondCompare.totalUaktBurnedForUact),
        totalActMinted: compare.totalUactMinted,
        dailyActMinted: daily(compare.totalUactMinted, secondCompare.totalUactMinted),
        totalActBurnedForAkt: compare.totalUactBurnedForUakt,
        dailyActBurnedForAkt: daily(compare.totalUactBurnedForUakt, secondCompare.totalUactBurnedForUakt),
        totalAktReminted: compare.totalUaktReminted,
        dailyAktReminted: daily(compare.totalUaktReminted, secondCompare.totalUaktReminted),
        netAktBurned: compare.totalUaktBurnedForUact - compare.totalUaktReminted,
        dailyNetAktBurned: daily(
          compare.totalUaktBurnedForUact - compare.totalUaktReminted,
          secondCompare.totalUaktBurnedForUact - secondCompare.totalUaktReminted
        )
      }
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getAktPrice(): Promise<number> {
    try {
      const marketData = await this.getMarketData("akash-network");
      return marketData.price;
    } catch {
      return 0;
    }
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getBmeStatusHistory(): Promise<BmeStatusHistoryResponse> {
    const rows = await this.statsRepository.findBmeStatusHistory();

    return rows.map(row => ({
      height: row.height,
      date: row.date,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      collateralRatio: row.collateralRatio
    }));
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getChainStats() {
    const bondedTokensAsPromised = runOrLog(async () => {
      const stakingPool = await this.cosmosHttpService.getStakingPool();

      return parseInt(stakingPool.bonded_tokens);
    }, 0);

    const totalSupplyAsPromised = runOrLog(async () => {
      const supply = await this.cosmosHttpService.getBankSupply();

      return parseInt(supply.find(x => x.denom === "uakt")?.amount || "0");
    }, 0);

    const communityPoolAsPromised = runOrLog(async () => {
      const pool = await this.cosmosHttpService.getCommunityPool();

      return parseFloat(pool.find(x => x.denom === "uakt")?.amount || "0");
    }, 0);

    const inflationAsPromised = runOrLog(async () => {
      return await this.cosmosHttpService.getInflation();
    }, 0);

    const communityTaxAsPromised = runOrLog(async () => {
      const params = await this.cosmosHttpService.getDistributionParams();

      return parseFloat(params.community_tax || "0");
    }, 0);

    const [bondedTokens, totalSupply, communityPool, inflation, communityTax] = await Promise.all([
      bondedTokensAsPromised,
      totalSupplyAsPromised,
      communityPoolAsPromised,
      inflationAsPromised,
      communityTaxAsPromised
    ]);

    let stakingAPR: number | undefined;
    if (bondedTokens && bondedTokens > 0 && inflation && communityTax && totalSupply) {
      stakingAPR = (inflation * (1 - communityTax) * totalSupply) / bondedTokens;
    }

    return {
      bondedTokens,
      totalSupply,
      communityPool,
      inflation,
      stakingAPR
    };
  }

  async getLegacyNetworkCapacity() {
    const capacity = await this.getNetworkCapacity();

    return {
      activeProviderCount: capacity.activeProviderCount,
      activeCPU: capacity.resources.cpu.active,
      pendingCPU: capacity.resources.cpu.pending,
      availableCPU: capacity.resources.cpu.available,
      totalCPU: capacity.resources.cpu.total,

      activeGPU: capacity.resources.gpu.active,
      pendingGPU: capacity.resources.gpu.pending,
      availableGPU: capacity.resources.gpu.available,
      totalGPU: capacity.resources.gpu.total,

      activeMemory: capacity.resources.memory.active,
      pendingMemory: capacity.resources.memory.pending,
      availableMemory: capacity.resources.memory.available,
      totalMemory: capacity.resources.memory.total,

      activeEphemeralStorage: capacity.resources.storage.ephemeral.active,
      pendingEphemeralStorage: capacity.resources.storage.ephemeral.pending,
      availableEphemeralStorage: capacity.resources.storage.ephemeral.available,
      totalEphemeralStorage: capacity.resources.storage.ephemeral.total,

      activePersistentStorage: capacity.resources.storage.persistent.active,
      pendingPersistentStorage: capacity.resources.storage.persistent.pending,
      availablePersistentStorage: capacity.resources.storage.persistent.available,
      totalPersistentStorage: capacity.resources.storage.persistent.total,

      activeStorage: capacity.resources.storage.total.active,
      pendingStorage: capacity.resources.storage.total.pending,
      availableStorage: capacity.resources.storage.total.available,
      totalStorage: capacity.resources.storage.total.total
    };
  }

  @Memoize({ ttlInSeconds: 15 })
  async getNetworkCapacity(): Promise<{ resources: ProviderCapacityStats; activeProviderCount: number }> {
    const providers = await this.statsRepository.findActiveProvidersWithSnapshots();

    const filteredProviders = uniqBy(providers, provider => provider.hostUri);
    const stats = {
      cpu: buildStatItem(0, 0, 0),
      gpu: buildStatItem(0, 0, 0),
      memory: buildStatItem(0, 0, 0),
      storage: {
        ephemeral: buildStatItem(0, 0, 0),
        persistent: buildStatItem(0, 0, 0),
        total: buildStatItem(0, 0, 0)
      }
    };

    await forEachInChunks(
      filteredProviders,
      provider => {
        stats.cpu.active += provider.lastSuccessfulSnapshot.activeCPU || 0;
        stats.cpu.pending += provider.lastSuccessfulSnapshot.pendingCPU || 0;
        stats.cpu.available += provider.lastSuccessfulSnapshot.availableCPU || 0;
        stats.cpu.total = stats.cpu.active + stats.cpu.pending + stats.cpu.available;

        stats.gpu.active += provider.lastSuccessfulSnapshot.activeGPU || 0;
        stats.gpu.pending += provider.lastSuccessfulSnapshot.pendingGPU || 0;
        stats.gpu.available += provider.lastSuccessfulSnapshot.availableGPU || 0;
        stats.gpu.total = stats.gpu.active + stats.gpu.pending + stats.gpu.available;

        stats.memory.active += provider.lastSuccessfulSnapshot.activeMemory || 0;
        stats.memory.pending += provider.lastSuccessfulSnapshot.pendingMemory || 0;
        stats.memory.available += provider.lastSuccessfulSnapshot.availableMemory || 0;
        stats.memory.total = stats.memory.active + stats.memory.pending + stats.memory.available;

        stats.storage.ephemeral.active += provider.lastSuccessfulSnapshot.activeEphemeralStorage || 0;
        stats.storage.ephemeral.pending += provider.lastSuccessfulSnapshot.pendingEphemeralStorage || 0;
        stats.storage.ephemeral.available += provider.lastSuccessfulSnapshot.availableEphemeralStorage || 0;
        stats.storage.ephemeral.total = stats.storage.ephemeral.active + stats.storage.ephemeral.pending + stats.storage.ephemeral.available;

        stats.storage.persistent.active += provider.lastSuccessfulSnapshot.activePersistentStorage || 0;
        stats.storage.persistent.pending += provider.lastSuccessfulSnapshot.pendingPersistentStorage || 0;
        stats.storage.persistent.available += provider.lastSuccessfulSnapshot.availablePersistentStorage || 0;
        stats.storage.persistent.total = stats.storage.persistent.active + stats.storage.persistent.pending + stats.storage.persistent.available;
      },
      { maxTimeSpentPerChunk: 15 }
    );

    stats.storage.total.active = stats.storage.ephemeral.active + stats.storage.persistent.active;
    stats.storage.total.pending = stats.storage.ephemeral.pending + stats.storage.persistent.pending;
    stats.storage.total.available = stats.storage.ephemeral.available + stats.storage.persistent.available;
    stats.storage.total.total = stats.storage.ephemeral.total + stats.storage.persistent.total;

    return {
      resources: stats,
      activeProviderCount: filteredProviders.length
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getMarketData(coin: MarketDataParams["coin"] | "akt") {
    const result = await this.denomExchangeService.getExchangeRateToUSD(coin);
    return result;
  }

  async convertToFiatAmount(amount: number, denom: MarketDataParams["coin"]): Promise<number> {
    const marketData = await this.getMarketData(denom);
    return amount * marketData.price;
  }

  async getLeasesDuration(owner: LeasesDurationParams["owner"], query: LeasesDurationQuery): Promise<LeasesDurationResponse> {
    const closedLeases = await this.statsRepository.findClosedLeases(owner, query);

    const leases = closedLeases.map(x => ({
      dseq: x.dseq,
      oseq: x.oseq,
      gseq: x.gseq,
      provider: x.providerAddress,
      startHeight: x.createdHeight,
      startDate: x.createdBlock.datetime.toISOString(),
      closedHeight: x.closedHeight as number,
      closedDate: x.closedBlock.datetime.toISOString(),
      durationInBlocks: (x.closedHeight as number) - x.createdHeight,
      durationInSeconds: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime),
      durationInHours: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime) / 3600
    }));

    const totalSeconds = leases.map(x => x.durationInSeconds).reduce((a, b) => a + b, 0);

    return {
      leaseCount: leases.length,
      totalDurationInSeconds: totalSeconds,
      totalDurationInHours: totalSeconds / 3600,
      leases
    };
  }
}

function stripLeadingZeros(stats: DateValue[]): DateValue[] {
  const firstWithValue = stats.findIndex(x => x.value > 0);
  return firstWithValue >= 0 ? stats.slice(firstWithValue) : stats;
}

function toRelativeValues(stats: DateValue[]): DateValue[] {
  return stats.map((dataPoint, index) => ({
    date: dataPoint.date,
    value: dataPoint.value - (index > 0 ? stats[index - 1].value : 0)
  }));
}

function buildStatItem(active: number, pending: number, available: number): StatsItem {
  return {
    active,
    pending,
    available,
    total: active + pending + available
  };
}
