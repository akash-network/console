import { sub } from "date-fns";
import { QueryTypes } from "sequelize";
import { inject, injectable } from "tsyringe";

import { chainDb } from "@src/db/dbConnection";
import { GpuBreakdownQuery } from "@src/gpu/http-schemas/gpu.schema";
import type { GpuType } from "@src/gpu/types/gpu.type";
import { toUTC } from "@src/utils";
import { GpuConfig } from "../config/env.config";
import { GPU_CONFIG } from "../providers/config.provider";

@injectable()
export class GpuRepository {
  readonly #gpuConfig: GpuConfig;

  constructor(@inject(GPU_CONFIG) gpuConfig: GpuConfig) {
    this.#gpuConfig = gpuConfig;
  }

  async getGpuList({
    providerAddress,
    providerHostUri,
    vendor,
    model,
    memorySize
  }: {
    providerAddress?: string;
    providerHostUri?: string;
    vendor?: string;
    model?: string;
    memorySize?: string;
  }) {
    return await chainDb.query<{
      hostUri: string;
      name: string;
      allocatable: number;
      allocated: number;
      modelId: string;
      vendor: string;
      modelName: string;
      interface: string;
      memorySize: string;
    }>(
      `
      WITH snapshots AS (
        SELECT DISTINCT ON("hostUri")
        ps.id AS id,
        "hostUri",
        p."owner"
        FROM provider p
        INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSuccessfulSnapshotId"
        WHERE p."isOnline" IS TRUE OR ps."checkDate" >= :grace_date
      )
      SELECT DISTINCT ON (s."hostUri", n."name") s."hostUri", n."name", n."gpuAllocatable" AS allocatable, n."gpuAllocated" AS allocated, gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
      FROM snapshots s
      INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=s.id AND n."gpuAllocatable" > 0
      LEFT JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = n.id
      WHERE
        (:vendor IS NULL OR gpu.vendor = :vendor)
        AND (:model IS NULL OR gpu.name = :model)
        AND (:memory_size IS NULL OR gpu."memorySize" = :memory_size)
        AND (:provider_address IS NULL OR s."owner" = :provider_address)
        AND (:provider_hosturi IS NULL OR s."hostUri" = :provider_hosturi)
  `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          vendor: vendor ?? null,
          model: model ?? null,
          memory_size: memorySize ?? null,
          provider_address: providerAddress ?? null,
          provider_hosturi: providerHostUri ?? null,
          grace_date: toUTC(sub(new Date(), { minutes: this.#gpuConfig.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES }))
        }
      }
    );
  }

  async getGpuBreakdown({ vendor, model }: GpuBreakdownQuery) {
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
  }

  async getGpusForPricing() {
    const gpuNodes = await chainDb.query<{
      hostUri: string;
      owner: string;
      name: string;
      allocatable: number;
      allocated: number;
      modelId: string;
      vendor: string;
      modelName: string;
      interface: string;
      memorySize: string;
    }>(
      `
      WITH snapshots AS (
        SELECT DISTINCT ON("hostUri")
        ps.id AS id,
        "hostUri",
        p."owner"
        FROM provider p
        INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSuccessfulSnapshotId"
        WHERE p."isOnline" IS TRUE OR ps."checkDate" >= :grace_date
        ORDER BY p."hostUri", p."createdHeight" DESC
      )
      SELECT s."hostUri", s."owner", n."name", n."gpuAllocatable" AS allocatable, LEAST(n."gpuAllocated", n."gpuAllocatable") AS allocated, gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
      FROM snapshots s
      INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=s.id AND n."gpuAllocatable" > 0
      LEFT JOIN LATERAL (
        SELECT gpu.*
        FROM "providerSnapshotNodeGPU" gpu
        WHERE gpu."snapshotNodeId" = n.id
        LIMIT 1
      ) gpu ON true
      WHERE
        gpu.vendor IS NOT NULL
  `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          grace_date: toUTC(sub(new Date(), { minutes: this.#gpuConfig.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES }))
        }
      }
    );

    const gpus: GpuType[] = [];

    for (const gpuNode of gpuNodes) {
      const nodeInfo = { owner: gpuNode.owner, hostUri: gpuNode.hostUri, allocated: gpuNode.allocated, allocatable: gpuNode.allocatable };

      const existingGpu = gpus.find(
        x => x.vendor === gpuNode.vendor && x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
      );

      if (existingGpu) {
        existingGpu.allocatable += gpuNode.allocatable;
        existingGpu.allocated += gpuNode.allocated;

        const existingProvider = existingGpu.providers.find(p => p.hostUri === gpuNode.hostUri);
        if (!existingProvider) {
          existingGpu.providers.push(nodeInfo);
        } else {
          existingProvider.allocated += gpuNode.allocated;
          existingProvider.allocatable += gpuNode.allocatable;
        }

        existingGpu.availableProviders = existingGpu.providers.filter(p => p.allocated < p.allocatable);
      } else {
        gpus.push({
          vendor: gpuNode.vendor,
          model: gpuNode.modelName,
          ram: gpuNode.memorySize,
          interface: gpuNode.interface,
          allocatable: gpuNode.allocatable,
          allocated: gpuNode.allocated,
          providers: [nodeInfo],
          availableProviders: gpuNode.allocated < gpuNode.allocatable ? [nodeInfo] : []
        });
      }
    }

    return gpus;
  }
}
