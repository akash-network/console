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
