import { QueryTypes } from "sequelize";

import { chainDb } from "@src/db/dbConnection";

export type AuthorizedGraphDataName =
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
