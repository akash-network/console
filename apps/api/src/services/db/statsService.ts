import { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { isSameDay, subHours } from "date-fns";
import { Op, QueryTypes } from "sequelize";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import type { ProviderActiveLeasesStats, ProviderStats, ProviderStatsKey } from "@src/types/graph";
import { env } from "@src/utils/env";
import { getGpuUtilization } from "./gpuBreakdownService";

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

type AuthorizedGraphDataName =
  | "dailyUAktSpent"
  | "dailyUUsdcSpent"
  | "dailyUUsdSpent"
  | "dailyLeaseCount"
  | "totalUAktSpent"
  | "totalUUsdcSpent"
  | "totalUUsdSpent"
  | "activeLeaseCount"
  | "totalLeaseCount"
  | "activeCPU"
  | "activeGPU"
  | "activeMemory"
  | "activeStorage"
  | "gpuUtilization";

export const AuthorizedGraphDataNames: AuthorizedGraphDataName[] = [
  "dailyUAktSpent",
  "dailyUUsdcSpent",
  "dailyUUsdSpent",
  "dailyLeaseCount",
  "totalUAktSpent",
  "totalUUsdcSpent",
  "totalUUsdSpent",
  "activeLeaseCount",
  "totalLeaseCount",
  "activeCPU",
  "activeGPU",
  "activeMemory",
  "activeStorage",
  "gpuUtilization"
];

export function isValidGraphDataName(x: string): x is AuthorizedGraphDataName {
  return AuthorizedGraphDataNames.includes(x as AuthorizedGraphDataName);
}

export async function getGraphData(dataName: AuthorizedGraphDataName): Promise<GraphData> {
  let attributes: (keyof Block)[] = [];
  let isRelative = false;
  let getter: (block: Block) => number = null;

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
    case "gpuUtilization":
      return await getGpuUtilization();
    default:
      attributes = [dataName];
      getter = (block: Block) => block[dataName];
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
    value: getter(day.lastBlock)
  }));

  if (dataName === "activeGPU") {
    const firstWithValue = stats.findIndex(x => x.value > 0);
    stats = stats.filter((_, i) => i >= firstWithValue);
  }

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
      return removeLastAroundMidnight(
        await chainDb.query<ProviderStats>(
          `SELECT d."date", (SUM("activeCPU") + SUM("pendingCPU") + SUM("availableCPU")) AS "cpu", (SUM("activeGPU") + SUM("pendingGPU") + SUM("availableGPU")) AS "gpu", (SUM("activeMemory") + SUM("pendingMemory") + SUM("availableMemory")) AS memory, (SUM("activeStorage") + SUM("pendingStorage") + SUM("availableStorage")) as storage, COUNT(*) as count
            FROM "day" d
            INNER JOIN (
            SELECT DISTINCT ON("hostUri",DATE("checkDate"))
              DATE("checkDate") AS date,
              ps."activeCPU", ps."pendingCPU", ps."availableCPU",
              ps."activeGPU", ps."pendingGPU", ps."availableGPU",
              ps."activeMemory", ps."pendingMemory", ps."availableMemory",
              ps."activeEphemeralStorage" + COALESCE(ps."activePersistentStorage", 0) AS "activeStorage", ps."pendingEphemeralStorage" + COALESCE(ps."pendingPersistentStorage", 0) AS "pendingStorage", ps."availableEphemeralStorage" + COALESCE(ps."availablePersistentStorage", 0) AS "availableStorage",
              ps."isOnline"
            FROM "providerSnapshot" ps
            INNER JOIN "day" d ON d."date" = DATE(ps."checkDate")
            INNER JOIN "block" b ON b.height=d."lastBlockHeightYet"
            INNER JOIN "provider" ON "provider"."owner"=ps."owner"
            WHERE ps."isLastSuccessOfDay" = TRUE AND ps."checkDate" >= b."datetime" - (:grace_duration * INTERVAL '1 minutes')
            ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
          ) "dailyProviderStats"
          ON DATE(d."date")="dailyProviderStats"."date"
          GROUP BY d."date"
          ORDER BY d."date" ASC`,
          {
            type: QueryTypes.SELECT,
            replacements: {
              grace_duration: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES
            }
          }
        )
      );
    },
    true
  );

  if (result.length < 2) {
    return {
      currentValue: 0,
      compareValue: 0,
      snapshots: [] as {
        date: string;
        value: number;
      }[]
    };
  }

  const currentValue = result[result.length - 1];
  const compareValue = result[result.length - 2];

  const stats = result.map(day => ({
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

const removeLastAroundMidnight = (stats: ProviderStats[]) => {
  const now = new Date();
  const isFirstFifteenMinuesOfDay = now.getHours() === 0 && now.getMinutes() <= 15;
  const lastItem = stats.length > 0 ? stats[stats.length - 1] : null;
  if (lastItem && typeof lastItem.date !== "string") {
    console.error(
      `removeLastAroundMidnight: lastItem.date is not a string: ` +
        `type = ${typeof lastItem.date} value = ${lastItem.date} constructor = ${(lastItem.date as any)?.constructor?.name}` +
        JSON.stringify(lastItem)
    );
  }
  const lastItemIsForToday = lastItem && isSameDay(lastItem.date, now);
  if (isFirstFifteenMinuesOfDay && lastItemIsForToday) {
    return stats.slice(0, stats.length - 1);
  }

  return stats;
};

export const getProviderActiveLeasesGraphData = async (providerAddress: string) => {
  console.log("getProviderActiveLeasesGraphData");

  const result = await chainDb.query<ProviderActiveLeasesStats>(
    `SELECT "date" AS date, COUNT(l."id") AS count
    FROM "day" d
    LEFT JOIN "lease" l
        ON l."providerAddress" = :providerAddress
        AND l."createdHeight" <= d."lastBlockHeightYet"
        AND COALESCE(l."closedHeight", l."predictedClosedHeight") > d."lastBlockHeightYet"
        AND (l."predictedClosedHeight" IS NULL OR l."predictedClosedHeight" > d."lastBlockHeightYet")
    INNER JOIN "provider" p
        ON p."owner" = :providerAddress
    WHERE d."lastBlockHeightYet" >= p."createdHeight"
    GROUP BY "date"
    ORDER BY "date" ASC`,
    {
      type: QueryTypes.SELECT,
      replacements: { providerAddress: providerAddress }
    }
  );

  if (result.length < 2) {
    return {
      currentValue: 0,
      compareValue: 0,
      snapshots: [] as {
        date: string;
        value: number;
      }[],
      now: {
        count: 0
      },
      compare: {
        count: 0
      }
    };
  }

  const currentValue = result[result.length - 1];
  const compareValue = result[result.length - 2];

  return {
    currentValue: currentValue.count,
    compareValue: compareValue.count,
    snapshots: result.map(day => ({
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

export async function getProviderTotalLeaseCountAtHeight(provider: string, height: number) {
  const [{ count: totalLeaseCount }] = await chainDb.query<{ count: number }>(
    `SELECT COUNT(*) FROM lease l WHERE "providerAddress"=:provider AND l."createdHeight" <= :height`,
    {
      type: QueryTypes.SELECT,
      replacements: { provider: provider, height: height }
    }
  );

  return totalLeaseCount;
}

export async function getProviderActiveResourcesAtHeight(provider: string, height: number) {
  const [activeStats] = await chainDb.query<{
    count: number;
    cpu: number;
    memory: number;
    ephemeralStorage: number;
    persistentStorage: number;
    gpu: number;
  }>(
    `
    SELECT
        COUNT(*) AS "count",
        SUM("cpuUnits") AS "cpu",
        SUM("memoryQuantity") AS "memory",
        SUM("ephemeralStorageQuantity") AS "ephemeralStorage",
        SUM("persistentStorageQuantity") AS "persistentStorage",
        SUM("gpuUnits") AS "gpu"
    FROM lease
    WHERE
        "providerAddress"=:provider
        AND "createdHeight" <= :height
        AND COALESCE("closedHeight", "predictedClosedHeight") > :height`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        provider: provider,
        height: height
      }
    }
  );

  return activeStats;
}

export async function getProviderEarningsAtHeight(provider: string, providerCreatedHeight: number, height: number) {
  const days = await chainDb.query<{ date: string; aktPrice: number; totalUAkt: number; totalUUsdc: number }>(
    `
    WITH provider_leases AS (
      SELECT dseq, price, "createdHeight", "closedHeight","predictedClosedHeight", "denom"
      FROM lease
      WHERE "providerAddress"=:provider
    )
    SELECT
      d.date, d."aktPrice",s."totalUAkt",s."totalUUsdc"
    FROM day d
    LEFT JOIN LATERAL (
      WITH active_leases AS (
        SELECT
          l.dseq,
          l.price,
          l.denom,
          (LEAST(d."lastBlockHeightYet", COALESCE(l."closedHeight", l."predictedClosedHeight"), :height) - GREATEST(d."firstBlockHeight", l."createdHeight", :providerCreatedHeight)) AS duration
        FROM provider_leases l
        WHERE
          l."createdHeight" <= LEAST(d."lastBlockHeightYet", :height)
          AND COALESCE(l."closedHeight", l."predictedClosedHeight") >= GREATEST(d."firstBlockHeight", :providerCreatedHeight)
      ),
      billed_leases AS (
        SELECT
          (CASE WHEN l.denom='uakt' THEN l.price*l.duration ELSE 0 END) AS "uakt_earned",
          (CASE WHEN l.denom='uusdc' THEN l.price*l.duration ELSE 0 END) AS "uusdc_earned"
        FROM active_leases l
      )
      SELECT
        SUM(l.uakt_earned) AS "totalUAkt",
        SUM(l.uusdc_earned) AS "totalUUsdc"
      FROM billed_leases l
    ) AS s ON 1=1
    WHERE d."lastBlockHeightYet" >= :providerCreatedHeight AND d."firstBlockHeight" <= :height
    ORDER BY d.date DESC
`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        provider: provider,
        height: height,
        providerCreatedHeight: providerCreatedHeight
      }
    }
  );

  return {
    uakt: days.reduce((acc, d) => acc + d.totalUAkt, 0),
    uusdc: days.reduce((acc, d) => acc + d.totalUUsdc, 0),
    uusd: days.reduce((acc, d) => acc + (d.totalUAkt * d.aktPrice + d.totalUUsdc), 0)
  };
}
