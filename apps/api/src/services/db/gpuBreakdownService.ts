import { QueryTypes } from "sequelize";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";

type GpuUtilizationData = {
  date: Date;
  cpuUtilization: number;
  cpu: number;
  gpuUtilization: number;
  gpu: number;
  count: number;
  node_count: number;
};

type GpuBreakdownData = {
  date: Date;
  vendor: string;
  model: string;
  providerCount: number;
  nodeCount: number;
  totalGpus: number;
  leasedGpus: number;
  gpuUtilization: number;
};

export async function getGpuUtilization() {
  return await cacheResponse(
    60 * 5,
    cacheKeys.getGpuUtilization,
    async () => {
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
    },
    true
  );
}

export async function getGpuBreakdownByVendorAndModel(vendor?: string, model?: string): Promise<GpuBreakdownData[]> {
  return await cacheResponse(
    60 * 5,
    cacheKeys.getGpuBreakdown + vendor + model,
    async () => {
      const result = await chainDb.query<{
        date: Date;
        vendor: string;
        model: string;
        provider_count: number;
        node_count: number;
        total_gpus: number;
        leased_gpus: number;
        gpuUtilization: number;
      }>(
        `
        WITH UTILIZATION AS (
          SELECT 
              d."date",
              COALESCE(gpu."vendor", 'Unknown') as "vendor",
              COALESCE(gpu."name", 'Unknown') as "model",
              COALESCE(COUNT(DISTINCT "dailyProviderStats"."hostUri"), 0) as provider_count,
              COALESCE(COUNT(DISTINCT n.id), 0) as node_count,
              COALESCE(COUNT(gpu.id), 0) as total_gpus,
              LEAST(COALESCE(CAST(ROUND(SUM(
                  CAST(n."gpuAllocated" as float) / 
                  NULLIF((SELECT COUNT(*) 
                          FROM "providerSnapshotNodeGPU" subgpu 
                          WHERE subgpu."snapshotNodeId" = n.id), 0)
              )) as int), 0), COUNT(gpu.id))  as leased_gpus,
              LEAST(CAST(COALESCE(
                  SUM(
                      CAST(n."gpuAllocated" as float) / 
                      NULLIF((SELECT COUNT(*) 
                              FROM "providerSnapshotNodeGPU" subgpu 
                              WHERE subgpu."snapshotNodeId" = n.id), 0)
                  ) * 100.0 / NULLIF(COUNT(gpu.id), 0)
              , 0) as numeric(10,2)), 100.00) as "gpuUtilization"
          FROM "day" d
          INNER JOIN (
              SELECT DISTINCT ON("hostUri", DATE("checkDate")) 
                  ps.id as "snapshotId",
                  "hostUri",
                  DATE("checkDate") AS date,
                  ps."isOnline"
              FROM "providerSnapshot" ps
              INNER JOIN "provider" ON "provider"."owner" = ps."owner"
              WHERE ps."isLastSuccessOfDay" = TRUE 
              ORDER BY "hostUri", DATE("checkDate"), "checkDate" DESC
          ) "dailyProviderStats" ON DATE(d."date") = "dailyProviderStats"."date"
          INNER JOIN "providerSnapshotNode" n ON n."snapshotId" = "dailyProviderStats"."snapshotId" AND n."gpuAllocatable" > 0
          LEFT JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = n.id
          WHERE (:vendor IS NULL OR LOWER(gpu."vendor") = LOWER(:vendor))
          AND (:model IS NULL OR LOWER(gpu."name") = LOWER(:model))
          GROUP BY d."date", gpu."vendor", gpu."name"
          ORDER BY d."date" ASC, gpu."vendor", gpu."name"
      )
      SELECT * FROM UTILIZATION
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            vendor: vendor ?? null,
            model: model ?? null
          }
        }
      );

      return result.map(row => ({
        date: row.date,
        vendor: row.vendor,
        model: row.model,
        providerCount: row.provider_count,
        nodeCount: row.node_count,
        totalGpus: row.total_gpus,
        leasedGpus: row.leased_gpus,
        gpuUtilization: row.gpuUtilization
      }));
    },
    true
  );
}

export async function getLatestGpuBreakdown(): Promise<GpuBreakdownData[]> {
  const allData = await getGpuBreakdownByVendorAndModel();
  const latestDate = allData.reduce((latest, current) => (latest > current.date ? latest : current.date), new Date(0));

  return allData.filter(data => data.date.getTime() === latestDate.getTime());
}
