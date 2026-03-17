import { AkashBlock as Block, Lease, Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { CoinGeckoHttpService, CosmosHttpService } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { differenceInSeconds, minutesToSeconds, sub, subHours } from "date-fns";
import uniqBy from "lodash/uniqBy";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { CHAIN_DB } from "@src/chain";
import { GraphDataResponse } from "@src/dashboard/http-schemas/graph-data/graph-data.schema";
import { LeasesDurationParams, LeasesDurationQuery, LeasesDurationResponse } from "@src/dashboard/http-schemas/leases-duration/leases-duration.schema";
import { MarketDataParams } from "@src/dashboard/http-schemas/market-data/market-data.schema";
import type { DashboardConfig } from "@src/dashboard/providers/config.provider";
import { DASHBOARD_CONFIG } from "@src/dashboard/providers/config.provider";
import { ProviderCapacityStats, StatsItem } from "@src/types/provider";
import { toUTC } from "@src/utils";
import { forEachInChunks } from "@src/utils/array/array";
import { createLoggingExecutor } from "@src/utils/logging";
import type { AuthorizedGraphDataName, DashboardGraphDataName } from "./stats.types";

const numberOrZero: (x: number | undefined | null) => number = (x: number | undefined | null) => (typeof x === "number" ? x : 0);

const logger = createOtelLogger({ context: "StatsService" });
const runOrLog = createLoggingExecutor(logger);

type GpuUtilizationData = {
  date: Date;
  cpuUtilization: number;
  cpu: number;
  gpuUtilization: number;
  gpu: number;
  count: number;
  node_count: number;
};

type DateValue = { date: Date; value: number };

type BlockMetricConfig = {
  attributes: (keyof Block)[];
  getter: (block: Block) => number;
  isRelative?: boolean;
  dashboardKey?: DashboardGraphDataName;
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
  dailyUUsdcSpent: { attributes: ["totalUUsdcSpent"], getter: b => numberOrZero(b.totalUUsdcSpent), dashboardKey: "dailyUUsdcSpent", isRelative: true },
  dailyUUsdSpent: { attributes: ["totalUUsdSpent"], getter: b => numberOrZero(b.totalUUsdSpent), dashboardKey: "dailyUUsdSpent", isRelative: true },
  dailyLeaseCount: { attributes: ["totalLeaseCount"], getter: b => numberOrZero(b.totalLeaseCount), dashboardKey: "dailyLeaseCount", isRelative: true },
  activeStorage: {
    attributes: ["activeEphemeralStorage", "activePersistentStorage"],
    getter: b => numberOrZero(b.activeEphemeralStorage) + numberOrZero(b.activePersistentStorage),
    dashboardKey: "activeStorage"
  },
  totalUAktSpent: { attributes: ["totalUAktSpent"], getter: b => numberOrZero(b.totalUAktSpent), dashboardKey: "totalUAktSpent" },
  totalUUsdcSpent: { attributes: ["totalUUsdcSpent"], getter: b => numberOrZero(b.totalUUsdcSpent), dashboardKey: "totalUUsdcSpent" },
  totalUUsdSpent: { attributes: ["totalUUsdSpent"], getter: b => numberOrZero(b.totalUUsdSpent), dashboardKey: "totalUUsdSpent" },
  activeLeaseCount: { attributes: ["activeLeaseCount"], getter: b => numberOrZero(b.activeLeaseCount), dashboardKey: "activeLeaseCount" },
  totalLeaseCount: { attributes: ["totalLeaseCount"], getter: b => numberOrZero(b.totalLeaseCount), dashboardKey: "totalLeaseCount" },
  activeCPU: { attributes: ["activeCPU"], getter: b => numberOrZero(b.activeCPU), dashboardKey: "activeCPU" },
  activeGPU: { attributes: ["activeGPU"], getter: b => numberOrZero(b.activeGPU), dashboardKey: "activeGPU" },
  activeMemory: { attributes: ["activeMemory"], getter: b => numberOrZero(b.activeMemory), dashboardKey: "activeMemory" },
  totalAktBurnedForAct: { attributes: ["totalUaktBurnedForUact"], getter: b => numberOrZero(b.totalUaktBurnedForUact) },
  dailyAktBurnedForAct: { attributes: ["totalUaktBurnedForUact"], getter: b => numberOrZero(b.totalUaktBurnedForUact), isRelative: true },
  totalActMinted: { attributes: ["totalUactMinted"], getter: b => numberOrZero(b.totalUactMinted) },
  dailyActMinted: { attributes: ["totalUactMinted"], getter: b => numberOrZero(b.totalUactMinted), isRelative: true },
  totalActBurnedForAkt: { attributes: ["totalUactBurnedForUakt"], getter: b => numberOrZero(b.totalUactBurnedForUakt) },
  dailyActBurnedForAkt: { attributes: ["totalUactBurnedForUakt"], getter: b => numberOrZero(b.totalUactBurnedForUakt), isRelative: true },
  totalAktReminted: { attributes: ["totalUaktReminted"], getter: b => numberOrZero(b.totalUaktReminted) },
  dailyAktReminted: { attributes: ["totalUaktReminted"], getter: b => numberOrZero(b.totalUaktReminted), isRelative: true },
  netAktBurned: {
    attributes: ["totalUaktBurnedForUact", "totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact) - numberOrZero(b.totalUaktReminted)
  },
  dailyNetAktBurned: {
    attributes: ["totalUaktBurnedForUact", "totalUaktReminted"],
    getter: b => numberOrZero(b.totalUaktBurnedForUact) - numberOrZero(b.totalUaktReminted),
    isRelative: true
  },
  outstandingAct: { attributes: ["outstandingUact"], getter: b => numberOrZero(b.outstandingUact) },
  vaultAkt: { attributes: ["vaultUakt"], getter: b => numberOrZero(b.vaultUakt) }
};

@singleton()
export class StatsService {
  readonly #dashboardConfig: DashboardConfig;
  readonly #chainDb: Sequelize;

  constructor(
    @inject(DASHBOARD_CONFIG) dashboardConfig: DashboardConfig,
    @inject(CHAIN_DB) chainDb: Sequelize,
    private readonly cosmosHttpService: CosmosHttpService,
    private readonly coinGeckoHttpService: CoinGeckoHttpService
  ) {
    this.#dashboardConfig = dashboardConfig;
    this.#chainDb = chainDb;
  }

  async getDashboardData() {
    const latestBlockStats = await Block.findOne({
      where: {
        isProcessed: true,
        totalUUsdSpent: { [Op.not]: null }
      },
      order: [["height", "DESC"]]
    });
    if (!latestBlockStats) {
      throw new Error("No blocks stats found");
    }

    const compareDate = subHours(latestBlockStats.datetime, 24);
    const compareBlockStats = (await Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: compareDate }
      }
    })) as Block;

    const secondCompareDate = subHours(latestBlockStats.datetime, 48);
    const secondCompareBlockStats = (await Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: secondCompareDate }
      }
    })) as Block;

    return {
      now: {
        date: latestBlockStats.datetime.toISOString(),
        height: latestBlockStats.height,
        activeLeaseCount: latestBlockStats.activeLeaseCount ?? 0,
        totalLeaseCount: latestBlockStats.totalLeaseCount ?? 0,
        dailyLeaseCount: numberOrZero(latestBlockStats.totalLeaseCount) - numberOrZero(compareBlockStats?.totalLeaseCount),
        totalUAktSpent: latestBlockStats.totalUAktSpent ?? 0,
        dailyUAktSpent: numberOrZero(latestBlockStats.totalUAktSpent) - numberOrZero(compareBlockStats?.totalUAktSpent),
        totalUUsdcSpent: latestBlockStats.totalUUsdcSpent ?? 0,
        dailyUUsdcSpent: numberOrZero(latestBlockStats.totalUUsdcSpent) - numberOrZero(compareBlockStats?.totalUUsdcSpent),
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
        totalUUsdcSpent: compareBlockStats.totalUUsdcSpent ?? 0,
        dailyUUsdcSpent: numberOrZero(compareBlockStats.totalUUsdcSpent) - numberOrZero(secondCompareBlockStats.totalUUsdcSpent),
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

    let stats = await this.fetchDailyBlockSnapshots(config.attributes, config.getter);

    if (dataName === "activeGPU") {
      stats = stripLeadingZeros(stats);
    }

    if (config.isRelative) {
      stats = toRelativeValues(stats);
    }

    return this.buildGraphDataResponse(stats, config.dashboardKey);
  }

  private async fetchDailyBlockSnapshots(attributes: (keyof Block)[], getter: (block: Block) => number): Promise<DateValue[]> {
    const result = await Day.findAll({
      attributes: ["date"],
      include: [
        {
          model: Block,
          as: "lastBlock",
          attributes: attributes,
          required: true
        }
      ],
      order: [["date", "ASC"]]
    });

    return result.map(day => ({
      date: day.date,
      value: getter(day.lastBlock!)
    }));
  }

  private async buildGraphDataResponse(stats: DateValue[], dashboardKey?: DashboardGraphDataName): Promise<GraphDataResponse> {
    if (dashboardKey) {
      const dashboardData = await this.getDashboardData();

      return {
        currentValue: numberOrZero(dashboardData.now[dashboardKey]),
        compareValue: numberOrZero(dashboardData.compare[dashboardKey]),
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
    const result = await this.#chainDb.query<GpuUtilizationData>(
      `/* dashboard-stats:gpu-utilization */ SELECT
          d."date",
          ROUND(
            COALESCE((SUM("activeCPU") + SUM("pendingCPU")) * 100.0 /
            NULLIF(SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU"), 0), 0),
            2
          )::float AS "cpuUtilization",
          COALESCE(SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU"), 0)::integer AS "cpu",
          ROUND(
            COALESCE((SUM("activeGPU") + SUM("pendingGPU")) * 100.0 /
            NULLIF(SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU"), 0), 0),
            2
          )::float AS "gpuUtilization",
          COALESCE(SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU"), 0)::integer AS "gpu",
          COUNT(*) as provider_count,
          COALESCE(COUNT(DISTINCT "nodeId"), 0) as node_count
        FROM "day" d
        INNER JOIN (
          SELECT DISTINCT ON("hostUri",DATE("checkDate"))
            DATE("checkDate") AS date,
            ps."activeCPU", ps."pendingCPU", ps."availableCPU",
            ps."activeGPU", ps."pendingGPU", ps."availableGPU",
            ps."isOnline",
            n.id as "nodeId"
          FROM "providerSnapshot" ps
          INNER JOIN "provider" ON "provider"."owner"=ps."owner"
          INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=ps.id AND n."gpuAllocatable" > 0
          LEFT JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = n.id
          WHERE ps."isLastSuccessOfDay" = TRUE
          ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
        ) "dailyProviderStats"
        ON DATE(d."date")="dailyProviderStats"."date"
        GROUP BY d."date"
        ORDER BY d."date" ASC`,
      {
        type: QueryTypes.SELECT
      }
    );

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
    const result = await this.#chainDb.query<{ date: Date; collateralRatio: number }>(
      `/* dashboard-stats:collateral-ratio */ SELECT
          d."date",
          CASE
            WHEN b."outstandingUact" IS NULL OR b."outstandingUact" = 0 THEN 0
            ELSE ROUND((COALESCE(b."vaultUakt", 0) * COALESCE(d."aktPrice", 0) / b."outstandingUact")::numeric, 6)::float
          END AS "collateralRatio"
        FROM "day" d
        INNER JOIN "block" b ON b."height" = d."lastBlockHeight"
        WHERE b."vaultUakt" IS NOT NULL
        ORDER BY d."date" ASC`,
      {
        type: QueryTypes.SELECT
      }
    );

    const stats = result.map(day => ({
      date: day.date,
      value: day.collateralRatio
    }));

    return {
      currentValue: stats[stats.length - 1]?.value ?? 0,
      compareValue: stats[stats.length - 2]?.value ?? 0,
      snapshots: stats
    };
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
    const providers = await Provider.findAll({
      where: {
        deletedHeight: null
      },
      include: [
        {
          required: true,
          model: ProviderSnapshot,
          as: "lastSuccessfulSnapshot",
          where: { checkDate: { [Op.gte]: toUTC(sub(new Date(), { minutes: this.#dashboardConfig.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES })) } }
        }
      ]
    });

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
  async getMarketData(coin: MarketDataParams["coin"]) {
    const response = await this.coinGeckoHttpService.getMarketData(coin);

    return {
      price: response.market_data.current_price.usd,
      volume: response.market_data.total_volume.usd,
      marketCap: response.market_data.market_cap.usd,
      marketCapRank: response.market_cap_rank,
      priceChange24h: response.market_data.price_change_24h,
      priceChangePercentage24: response.market_data.price_change_percentage_24h
    };
  }

  async convertToFiatAmount(amount: number, denom: MarketDataParams["coin"]): Promise<number> {
    const marketData = await this.getMarketData(denom);
    return amount * marketData.price;
  }

  async getLeasesDuration(owner: LeasesDurationParams["owner"], query: LeasesDurationQuery): Promise<LeasesDurationResponse> {
    const { dseq, startDate, endDate } = query;
    const closedLeases = await Lease.findAll({
      where: {
        owner: owner,
        closedHeight: { [Op.not]: null },
        "$createdBlock.datetime$": { [Op.gte]: startDate },
        "$closedBlock.datetime$": { [Op.lte]: endDate },
        ...(dseq ? { dseq: dseq } : {})
      },
      include: [
        { model: Block, as: "createdBlock" },
        { model: Block, as: "closedBlock" }
      ]
    });

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
