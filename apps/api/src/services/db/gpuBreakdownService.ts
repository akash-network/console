import { QueryTypes } from "sequelize";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";

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
