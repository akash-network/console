import { AkashBlock as Block, Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import axios from "axios";
import { minutesToSeconds, sub, subHours } from "date-fns";
import uniqBy from "lodash/uniqBy";
import { Op, QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { AuthorizedGraphDataName } from "@src/services/db/statsService";
import { CosmosDistributionCommunityPoolResponse } from "@src/types/rest";
import { CosmosBankSupplyResponse } from "@src/types/rest/cosmosBankSupplyResponse";
import { CosmosDistributionParamsResponse } from "@src/types/rest/cosmosDistributionParamsResponse";
import { CosmosMintInflationResponse } from "@src/types/rest/cosmosMintInflationResponse";
import { CosmosStakingPoolResponse } from "@src/types/rest/cosmosStakingPoolResponse";
import { toUTC } from "@src/utils";
import { apiNodeUrl } from "@src/utils/constants";
import { env } from "@src/utils/env";
import { createLoggingExecutor } from "@src/utils/logging";
import { GraphDataResponse } from "../../http-schemas/graph-data/graph-data.schema";

const numberOrZero = (x: number | undefined | null) => (typeof x === "number" ? x : 0);

const logger = LoggerService.forContext("StatsService");
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

@singleton()
export class StatsService {
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
    const compareBlockStats = await Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: compareDate }
      }
    });

    const secondCompareDate = subHours(latestBlockStats.datetime, 48);
    const secondCompareBlockStats = await Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: secondCompareDate }
      }
    });

    return {
      now: {
        date: latestBlockStats.datetime,
        height: latestBlockStats.height,
        activeLeaseCount: latestBlockStats.activeLeaseCount,
        totalLeaseCount: latestBlockStats.totalLeaseCount,
        dailyLeaseCount: numberOrZero(latestBlockStats.totalLeaseCount) - numberOrZero(compareBlockStats?.totalLeaseCount),
        totalUAktSpent: latestBlockStats.totalUAktSpent,
        dailyUAktSpent: numberOrZero(latestBlockStats.totalUAktSpent) - numberOrZero(compareBlockStats?.totalUAktSpent),
        totalUUsdcSpent: latestBlockStats.totalUUsdcSpent,
        dailyUUsdcSpent: numberOrZero(latestBlockStats.totalUUsdcSpent) - numberOrZero(compareBlockStats?.totalUUsdcSpent),
        totalUUsdSpent: latestBlockStats.totalUUsdSpent,
        dailyUUsdSpent: numberOrZero(latestBlockStats.totalUUsdSpent) - numberOrZero(compareBlockStats?.totalUUsdSpent),
        activeCPU: latestBlockStats.activeCPU,
        activeGPU: latestBlockStats.activeGPU,
        activeMemory: latestBlockStats.activeMemory,
        activeStorage: numberOrZero(latestBlockStats.activeEphemeralStorage) + numberOrZero(latestBlockStats.activePersistentStorage)
      },
      compare: {
        date: compareBlockStats?.datetime,
        height: compareBlockStats?.height,
        activeLeaseCount: compareBlockStats?.activeLeaseCount,
        totalLeaseCount: compareBlockStats?.totalLeaseCount,
        dailyLeaseCount: numberOrZero(compareBlockStats?.totalLeaseCount) - numberOrZero(secondCompareBlockStats?.totalLeaseCount),
        totalUAktSpent: compareBlockStats?.totalUAktSpent,
        dailyUAktSpent: numberOrZero(compareBlockStats?.totalUAktSpent) - numberOrZero(secondCompareBlockStats?.totalUAktSpent),
        totalUUsdcSpent: compareBlockStats?.totalUUsdcSpent,
        dailyUUsdcSpent: numberOrZero(compareBlockStats?.totalUUsdcSpent) - numberOrZero(secondCompareBlockStats?.totalUUsdcSpent),
        totalUUsdSpent: compareBlockStats?.totalUUsdSpent,
        dailyUUsdSpent: numberOrZero(compareBlockStats?.totalUUsdSpent) - numberOrZero(secondCompareBlockStats?.totalUUsdSpent),
        activeCPU: compareBlockStats?.activeCPU,
        activeGPU: compareBlockStats?.activeGPU,
        activeMemory: compareBlockStats?.activeMemory,
        activeStorage: numberOrZero(compareBlockStats?.activeEphemeralStorage) + numberOrZero(compareBlockStats?.activePersistentStorage)
      }
    };
  }

  async getGraphData(dataName: AuthorizedGraphDataName): Promise<GraphDataResponse> {
    let attributes: (keyof Block)[] = [];
    let isRelative = false;
    let getter: (block: Block) => number;

    switch (dataName) {
      case "dailyUAktSpent":
        attributes = ["totalUAktSpent"];
        getter = (block: Block) => numberOrZero(block.totalUAktSpent);
        isRelative = true;
        break;
      case "dailyUUsdcSpent":
        attributes = ["totalUUsdcSpent"];
        getter = (block: Block) => numberOrZero(block.totalUUsdcSpent);
        isRelative = true;
        break;
      case "dailyUUsdSpent":
        attributes = ["totalUUsdSpent"];
        getter = (block: Block) => numberOrZero(block.totalUUsdSpent);
        isRelative = true;
        break;
      case "dailyLeaseCount":
        attributes = ["totalLeaseCount"];
        getter = (block: Block) => numberOrZero(block.totalLeaseCount);
        isRelative = true;
        break;
      case "activeStorage":
        attributes = ["activeEphemeralStorage", "activePersistentStorage"];
        getter = (block: Block) => numberOrZero(block.activeEphemeralStorage) + numberOrZero(block.activePersistentStorage);
        break;
      case "gpuUtilization":
        return await this.getGpuUtilization();
      default:
        attributes = [dataName];
        getter = (block: Block) => numberOrZero(block[dataName]);
    }

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

    let stats = result.map(day => ({
      date: day.date,
      value: getter(day.lastBlock!)
    }));

    if (dataName === "activeGPU") {
      const firstWithValue = stats.findIndex(x => x.value > 0);
      stats = stats.filter((_, i) => i >= firstWithValue);
    }

    if (isRelative) {
      const relativeStats = stats.reduce<{ date: Date; value: number }[]>((arr, dataPoint, index) => {
        arr[index] = {
          date: dataPoint.date,
          value: dataPoint.value - (index > 0 ? stats[index - 1].value : 0)
        };

        return arr;
      }, []);

      stats = relativeStats;
    }

    const dashboardData = await this.getDashboardData();

    return {
      currentValue: numberOrZero(dashboardData.now[dataName]),
      compareValue: numberOrZero(dashboardData.compare[dataName]),
      snapshots: stats
    };
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  private async getGpuUtilization() {
    const result = await chainDb.query<GpuUtilizationData>(
      `SELECT
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
  async getChainStats() {
    const bondedTokensAsPromised = await runOrLog(async () => {
      const bondedTokensQuery = await axios.get<CosmosStakingPoolResponse>(`${apiNodeUrl}/cosmos/staking/v1beta1/pool`);
      return parseInt(bondedTokensQuery.data.pool.bonded_tokens);
    }, 0);

    const totalSupplyAsPromised = await runOrLog(async () => {
      const supplyQuery = await axios.get<CosmosBankSupplyResponse>(`${apiNodeUrl}/cosmos/bank/v1beta1/supply?pagination.limit=1000`);
      return parseInt(supplyQuery.data.supply.find(x => x.denom === "uakt")?.amount || "0");
    }, 0);

    const communityPoolAsPromised = await runOrLog(async () => {
      const communityPoolQuery = await axios.get<CosmosDistributionCommunityPoolResponse>(`${apiNodeUrl}/cosmos/distribution/v1beta1/community_pool`);
      return parseFloat(communityPoolQuery.data.pool.find(x => x.denom === "uakt")?.amount || "0");
    }, 0);

    const inflationAsPromised = await runOrLog(async () => {
      const inflationQuery = await axios.get<CosmosMintInflationResponse>(`${apiNodeUrl}/cosmos/mint/v1beta1/inflation`);
      return parseFloat(inflationQuery.data.inflation || "0");
    }, 0);

    const communityTaxAsPromised = await runOrLog(async () => {
      const distributionQuery = await axios.get<CosmosDistributionParamsResponse>(`${apiNodeUrl}/cosmos/distribution/v1beta1/params`);
      return parseFloat(distributionQuery.data.params.community_tax || "0");
    }, 0);

    const [bondedTokens, totalSupply, communityPool, inflation, communityTax] = await Promise.all([
      bondedTokensAsPromised,
      totalSupplyAsPromised,
      communityPoolAsPromised,
      inflationAsPromised,
      communityTaxAsPromised
    ]);

    const result = {
      communityPool,
      inflation,
      communityTax,
      bondedTokens,
      totalSupply
    };

    let stakingAPR: number | undefined;
    if (result.bondedTokens && result.bondedTokens > 0 && result.inflation && result.communityTax && result.totalSupply) {
      stakingAPR = (result.inflation * (1 - result.communityTax) * result.totalSupply) / result.bondedTokens;
    }

    return {
      bondedTokens: result.bondedTokens,
      totalSupply: result.totalSupply,
      communityPool: result.communityPool,
      inflation: result.inflation,
      stakingAPR
    };
  }

  async getNetworkCapacity() {
    const providers = await Provider.findAll({
      where: {
        deletedHeight: null
      },
      include: [
        {
          required: true,
          model: ProviderSnapshot,
          as: "lastSuccessfulSnapshot",
          where: { checkDate: { [Op.gte]: toUTC(sub(new Date(), { minutes: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES })) } }
        }
      ]
    });

    const filteredProviders = uniqBy(providers, provider => provider.hostUri);
    const stats = filteredProviders.reduce(
      (all, provider) => {
        all.activeCPU += provider.lastSuccessfulSnapshot.activeCPU || 0;
        all.pendingCPU += provider.lastSuccessfulSnapshot.pendingCPU || 0;
        all.availableCPU += provider.lastSuccessfulSnapshot.availableCPU || 0;

        all.activeGPU += provider.lastSuccessfulSnapshot.activeGPU || 0;
        all.pendingGPU += provider.lastSuccessfulSnapshot.pendingGPU || 0;
        all.availableGPU += provider.lastSuccessfulSnapshot.availableGPU || 0;

        all.activeMemory += provider.lastSuccessfulSnapshot.activeMemory || 0;
        all.pendingMemory += provider.lastSuccessfulSnapshot.pendingMemory || 0;
        all.availableMemory += provider.lastSuccessfulSnapshot.availableMemory || 0;

        all.activeEphemeralStorage += provider.lastSuccessfulSnapshot.activeEphemeralStorage || 0;
        all.pendingEphemeralStorage += provider.lastSuccessfulSnapshot.pendingEphemeralStorage || 0;
        all.availableEphemeralStorage += provider.lastSuccessfulSnapshot.availableEphemeralStorage || 0;

        all.activePersistentStorage += provider.lastSuccessfulSnapshot.activePersistentStorage || 0;
        all.pendingPersistentStorage += provider.lastSuccessfulSnapshot.pendingPersistentStorage || 0;
        all.availablePersistentStorage += provider.lastSuccessfulSnapshot.availablePersistentStorage || 0;

        return all;
      },
      {
        activeCPU: 0,
        pendingCPU: 0,
        availableCPU: 0,
        activeGPU: 0,
        pendingGPU: 0,
        availableGPU: 0,
        activeMemory: 0,
        pendingMemory: 0,
        availableMemory: 0,
        activeStorage: 0,
        pendingStorage: 0,
        availableStorage: 0,
        activeEphemeralStorage: 0,
        pendingEphemeralStorage: 0,
        availableEphemeralStorage: 0,
        activePersistentStorage: 0,
        pendingPersistentStorage: 0,
        availablePersistentStorage: 0
      }
    );

    stats.activeStorage = stats.activeEphemeralStorage + stats.activePersistentStorage;
    stats.pendingStorage = stats.pendingEphemeralStorage + stats.pendingPersistentStorage;
    stats.availableStorage = stats.availableEphemeralStorage + stats.availablePersistentStorage;

    return {
      activeProviderCount: filteredProviders.length,
      ...stats,
      totalCPU: stats.activeCPU + stats.pendingCPU + stats.availableCPU,
      totalGPU: stats.activeGPU + stats.pendingGPU + stats.availableGPU,
      totalMemory: stats.activeMemory + stats.pendingMemory + stats.availableMemory,
      totalStorage: stats.activeStorage + stats.pendingStorage + stats.availableStorage
    };
  }
}
