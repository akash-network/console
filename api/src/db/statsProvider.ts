import { Day } from "@shared/dbSchemas/base";
import { AkashBlock as Block } from "@shared/dbSchemas/akash";
import { subHours } from "date-fns";
import { Op, QueryTypes } from "sequelize";
import { chainDb } from "./dbConnection";
import { ProviderActiveLeasesStats, ProviderStats, ProviderStatsKey } from "@src/types/graph";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";

type GraphData = {
  currentValue: number;
  compareValue: number;
  snapshots: { date: Date; value: number }[];
};

export const getDashboardData = async () => {
  const latestBlockStats = await Block.findOne({
    where: {
      isProcessed: true,
      totalUUsdSpent: { [Op.not]: null }
    },
    order: [["height", "DESC"]]
  });

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
      dailyLeaseCount: latestBlockStats.totalLeaseCount - compareBlockStats.totalLeaseCount,
      totalUAktSpent: latestBlockStats.totalUAktSpent,
      dailyUAktSpent: latestBlockStats.totalUAktSpent - compareBlockStats.totalUAktSpent,
      totalUUsdcSpent: latestBlockStats.totalUUsdcSpent,
      dailyUUsdcSpent: latestBlockStats.totalUUsdcSpent - compareBlockStats.totalUUsdcSpent,
      totalUUsdSpent: latestBlockStats.totalUUsdSpent,
      dailyUUsdSpent: latestBlockStats.totalUUsdSpent - compareBlockStats.totalUUsdSpent,
      activeCPU: latestBlockStats.activeCPU,
      activeGPU: latestBlockStats.activeGPU,
      activeMemory: latestBlockStats.activeMemory,
      activeStorage: latestBlockStats.activeEphemeralStorage + latestBlockStats.activePersistentStorage
    },
    compare: {
      date: compareBlockStats.datetime,
      height: compareBlockStats.height,
      activeLeaseCount: compareBlockStats.activeLeaseCount,
      totalLeaseCount: compareBlockStats.totalLeaseCount,
      dailyLeaseCount: compareBlockStats.totalLeaseCount - secondCompareBlockStats.totalLeaseCount,
      totalUAktSpent: compareBlockStats.totalUAktSpent,
      dailyUAktSpent: compareBlockStats.totalUAktSpent - secondCompareBlockStats.totalUAktSpent,
      totalUUsdcSpent: compareBlockStats.totalUUsdcSpent,
      dailyUUsdcSpent: compareBlockStats.totalUUsdcSpent - secondCompareBlockStats.totalUUsdcSpent,
      totalUUsdSpent: compareBlockStats.totalUUsdSpent,
      dailyUUsdSpent: compareBlockStats.totalUUsdSpent - secondCompareBlockStats.totalUUsdSpent,
      activeCPU: compareBlockStats.activeCPU,
      activeGPU: compareBlockStats.activeGPU,
      activeMemory: compareBlockStats.activeMemory,
      activeStorage: compareBlockStats.activeEphemeralStorage + compareBlockStats.activePersistentStorage
    }
  };
};

export async function getGraphData(dataName: string): Promise<GraphData> {
  console.log("getGraphData: " + dataName);

  let attributes = [dataName];
  let isRelative = false;
  let getter = (block: Block) => block[dataName] as number;

  switch (dataName) {
    case "dailyUAktSpent":
      attributes = ["totalUAktSpent"];
      getter = (block: Block) => block.totalUAktSpent;
      isRelative = true;
      break;
    case "dailyUUsdcSpent":
      attributes = ["totalUUsdcSpent"];
      getter = (block: Block) => block.totalUUsdcSpent;
      isRelative = true;
      break;
    case "dailyUUsdSpent":
      attributes = ["totalUUsdSpent"];
      getter = (block: Block) => block.totalUUsdSpent;
      isRelative = true;
      break;
    case "dailyLeaseCount":
      attributes = ["totalLeaseCount"];
      getter = (block: Block) => block.totalLeaseCount;
      isRelative = true;
      break;
    case "activeStorage":
      attributes = ["activeEphemeralStorage", "activePersistentStorage"];
      getter = (block: Block) => block.activeEphemeralStorage + block.activePersistentStorage;
      break;
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

  let stats = result.map((day) => ({
    date: day.date,
    value: getter(day.lastBlock)
  }));

  if (isRelative) {
    const relativeStats = stats.reduce((arr, dataPoint, index) => {
      arr[index] = {
        date: dataPoint.date,
        value: dataPoint.value - (index > 0 ? stats[index - 1].value : 0)
      };

      return arr;
    }, []);

    stats = relativeStats;
  }

  const dashboardData = await getDashboardData();

  return {
    currentValue: dashboardData.now[dataName],
    compareValue: dashboardData.compare[dataName],
    snapshots: stats
  };
}

export const getProviderGraphData = async (dataName: ProviderStatsKey) => {
  console.log("getProviderGraphData: " + dataName);

  const getter = (block: ProviderStats) => (typeof block[dataName] === "number" ? (block[dataName] as number) : parseInt(block[dataName] as string) || 0);

  const result = await cacheResponse(
    60 * 5, // 5 minutes
    cacheKeys.getProviderGraphData,
    async () => {
      return (await chainDb.query(
        `SELECT d."date", (SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU")) AS "cpu", (SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU")) AS "gpu", (SUM("activeMemory") + SUM("pendingMemory") + SUM("availableMemory")) AS memory, (SUM("activeStorage") + SUM("pendingStorage") + SUM("availableStorage")) as storage, COUNT(*) as count
        FROM "day" d
        INNER JOIN (
            SELECT DISTINCT ON("hostUri",DATE("checkDate")) DATE("checkDate") AS date, ps."activeCPU", ps."pendingCPU", ps."availableCPU", ps."activeGPU", ps."pendingGPU", ps."availableGPU", ps."activeMemory", ps."pendingMemory", ps."availableMemory", ps."activeStorage", ps."pendingStorage", ps."availableStorage", ps."isOnline"
                        FROM "providerSnapshot" ps
                        INNER JOIN "provider" ON "provider"."owner"=ps."owner"
                        ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
            ) "dailyProviderStats"
        ON d."date"="dailyProviderStats"."date" AND "isOnline" IS TRUE
        GROUP BY d."date"
        ORDER BY d."date" ASC`,
        {
          type: QueryTypes.SELECT
        }
      )) as ProviderStats[];
    },
    true
  );

  if (result.length < 2) {
    return {
      currentValue: 0,
      compareValue: 0,
      snapshots: []
    };
  }

  const currentValue = result[result.length - 1] as ProviderStats;
  const compareValue = result[result.length - 2] as ProviderStats;

  const stats = result.map((day) => ({
    date: day.date,
    value: getter(day)
  }));

  return {
    currentValue: typeof currentValue[dataName] === "number" ? currentValue[dataName] : parseInt(currentValue[dataName] as string),
    compareValue: typeof compareValue[dataName] === "number" ? compareValue[dataName] : parseInt(compareValue[dataName] as string),
    snapshots: stats,

    // To compare from previous day
    now: {
      count: currentValue.count,
      cpu: parseInt(currentValue.cpu),
      gpu: parseInt(currentValue.gpu),
      memory: parseInt(currentValue.memory),
      storage: parseInt(currentValue.storage)
    },
    compare: {
      count: compareValue.count,
      cpu: parseInt(compareValue.cpu),
      gpu: parseInt(compareValue.gpu),
      memory: parseInt(compareValue.memory),
      storage: parseInt(compareValue.storage)
    }
  };
};

export const getProviderActiveLeasesGraphData = async (providerAddress: string) => {
  console.log("getProviderActiveLeasesGraphData");

  const result: ProviderActiveLeasesStats[] = (await chainDb.query(
    `SELECT "date" AS date, COUNT(l."id") AS count
    FROM "day" d
    LEFT JOIN "lease" l 
        ON l."providerAddress" = ':providerAddress'
        AND l."createdHeight" <= d."lastBlockHeightYet"
        AND (l."closedHeight" IS NULL OR l."closedHeight" > d."lastBlockHeightYet")
        AND (l."predictedClosedHeight" IS NULL OR l."predictedClosedHeight" > d."lastBlockHeightYet")
    GROUP BY "date"
    ORDER BY "date" ASC`,
    {
      type: QueryTypes.SELECT,
      replacements: { providerAddress: providerAddress }
    }
  )) as ProviderActiveLeasesStats[];

  const currentValue = result[result.length - 1] as ProviderActiveLeasesStats;
  const compareValue = result[result.length - 2] as ProviderActiveLeasesStats;

  return {
    currentValue: currentValue.count,
    compareValue: compareValue.count,
    snapshots: result.map((day) => ({
      date: day.date,
      value: day.count
    })),

    // To compare from previous day
    now: {
      count: currentValue.count
    },
    compare: {
      count: compareValue.count
    }
  };
};
