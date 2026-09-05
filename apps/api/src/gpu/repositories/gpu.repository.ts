import { addDays, sub } from "date-fns";
import { QueryTypes, Sequelize } from "sequelize";
import { inject, injectable } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { GpuBreakdownQuery } from "@src/gpu/http-schemas/gpu.schema";
import type { GpuType } from "@src/gpu/types/gpu.type";
import { toUTC } from "@src/utils";
import type { GpuConfig } from "../config/env.config";
import { GPU_CONFIG } from "../providers/config.provider";

@injectable()
export class GpuRepository {
  readonly #gpuConfig: GpuConfig;
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize, @inject(GPU_CONFIG) gpuConfig: GpuConfig) {
    this.#chainDb = chainDb;
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
    return await this.#chainDb.query<{
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
      `/* gpu:list */
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

  async getGpuBreakdown({ vendor, model, startDate, endDate }: GpuBreakdownQuery) {
    const windowStart = new Date(`${startDate}T00:00:00.000Z`);
    const windowEndExclusive = addDays(new Date(`${endDate}T00:00:00.000Z`), 1);

    const result = await this.#chainDb.query<{
      date: Date;
      vendor: string;
      model: string;
      provider_count: number;
      node_count: number;
      total_gpus: number;
      leased_gpus: number;
      gpuUtilization: number;
    }>(
      `/* gpu:breakdown */
        WITH daily_snapshots AS (
          SELECT DISTINCT ON (p."hostUri", DATE(ps."checkDate"))
            ps.id AS "snapshotId",
            p."hostUri",
            DATE(ps."checkDate") AS date
          FROM "providerSnapshot" ps
          INNER JOIN "provider" p ON p."owner" = ps."owner"
          WHERE ps."isLastSuccessOfDay" = TRUE
            AND ps."checkDate" >= :window_start
            AND ps."checkDate" < :window_end_exclusive
          ORDER BY p."hostUri", DATE(ps."checkDate"), ps."checkDate" DESC
        ),
        gpu_nodes AS (
          SELECT
            n.id,
            n."gpuAllocated",
            s."hostUri",
            s.date,
            gpu_count.total AS gpu_count
          FROM daily_snapshots s
          INNER JOIN "providerSnapshotNode" n ON n."snapshotId" = s."snapshotId" AND n."gpuAllocatable" > 0
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS total
            FROM "providerSnapshotNodeGPU" g
            WHERE g."snapshotNodeId" = n.id
          ) gpu_count ON TRUE
        )
        SELECT
          d."date",
          COALESCE(gpu."vendor", 'Unknown') AS "vendor",
          COALESCE(gpu."name", 'Unknown') AS "model",
          COUNT(DISTINCT n."hostUri") AS provider_count,
          COUNT(DISTINCT n.id) AS node_count,
          COUNT(gpu.id) AS total_gpus,
          LEAST(
            ROUND(COALESCE(SUM(n."gpuAllocated"::float / NULLIF(n.gpu_count, 0)), 0))::int,
            COUNT(gpu.id)
          ) AS leased_gpus,
          LEAST(
            ROUND(COALESCE(SUM(n."gpuAllocated"::float / NULLIF(n.gpu_count, 0)) * 100.0 / NULLIF(COUNT(gpu.id), 0), 0)::numeric, 2),
            100
          )::float AS "gpuUtilization"
        FROM "day" d
        INNER JOIN gpu_nodes n ON n.date = DATE(d."date")
        LEFT JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = n.id
        WHERE d."date" >= :window_start
          AND d."date" < :window_end_exclusive
          AND (:vendor IS NULL OR LOWER(gpu."vendor") = LOWER(:vendor))
          AND (:model IS NULL OR LOWER(gpu."name") = LOWER(:model))
        GROUP BY d."date", gpu."vendor", gpu."name"
        ORDER BY d."date" ASC, gpu."vendor", gpu."name"
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          vendor: vendor ?? null,
          model: model ?? null,
          window_start: windowStart,
          window_end_exclusive: windowEndExclusive
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
    const gpuNodes = await this.#chainDb.query<{
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
      `/* gpu:pricing */
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
