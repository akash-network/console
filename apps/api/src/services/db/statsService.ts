import { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { subHours } from "date-fns";
import { Op, QueryTypes } from "sequelize";

import { chainDb } from "@src/db/dbConnection";
import { getGpuUtilization } from "./gpuBreakdownService";

type GraphData = {
  currentValue: number;
  compareValue: number;
  snapshots: { date: Date; value: number }[];
};

const numberOrZero = (x: number | undefined | null) => (typeof x === "number" ? x : 0);
export const getDashboardData = async () => {
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
      return await getGpuUtilization();
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

  const dashboardData = await getDashboardData();

  return {
    currentValue: numberOrZero(dashboardData.now[dataName]),
    compareValue: numberOrZero(dashboardData.compare[dataName]),
    snapshots: stats
  };
}

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
