import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sub } from "date-fns";
import { QueryTypes } from "sequelize";

import { chainDb } from "@src/db/dbConnection";
import { toUTC } from "@src/utils";
import { isValidBech32Address } from "@src/utils/addresses";
import { env } from "@src/utils/env";

const route = createRoute({
  method: "get",
  path: "/gpu",
  summary: "Get a list of gpu models and their availability.",
  request: {
    query: z.object({
      provider: z.string().optional(),
      vendor: z.string().optional(),
      model: z.string().optional(),
      memory_size: z.string().optional()
    })
  },
  responses: {
    200: {
      description: "List of gpu models and their availability.",
      content: {
        "application/json": {
          schema: z.object({
            gpus: z.object({
              total: z.object({
                allocatable: z.number(),
                allocated: z.number()
              }),
              details: z.record(
                z.string(),
                z.array(
                  z.object({
                    model: z.string(),
                    ram: z.string(),
                    interface: z.string(),
                    allocatable: z.number(),
                    allocated: z.number()
                  })
                )
              )
            })
          })
        }
      }
    },
    400: {
      description: "Invalid provider parameter, should be a valid akash address or host uri"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const provider = c.req.query("provider");
  const vendor = c.req.query("vendor");
  const model = c.req.query("model");
  const memory_size = c.req.query("memory_size");

  let provider_address: string | null = null;
  let provider_hosturi: string | null = null;

  if (provider) {
    if (isValidBech32Address(provider)) {
      provider_address = provider;
    } else if (URL.canParse(provider)) {
      provider_hosturi = provider;
    } else {
      return c.json({ error: "Invalid provider parameter, should be a valid akash address or host uri" }, 400);
    }
  }

  const gpuNodes = await chainDb.query<{
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
      SELECT s."hostUri", n."name", n."gpuAllocatable" AS allocatable, n."gpuAllocated" AS allocated, gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
      FROM snapshots s
      INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=s.id AND n."gpuAllocatable" > 0
      LEFT JOIN (
        SELECT DISTINCT ON (gpu."snapshotNodeId") gpu.*
        FROM "providerSnapshotNodeGPU" gpu
      ) gpu ON gpu."snapshotNodeId" = n.id
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
        memory_size: memory_size ?? null,
        provider_address: provider_address ?? null,
        provider_hosturi: provider_hosturi ?? null,
        grace_date: toUTC(sub(new Date(), { minutes: env.ProviderUptimeGracePeriodMinutes }))
      }
    }
  );

  const response = {
    gpus: {
      total: {
        allocatable: gpuNodes.map(x => x.allocatable).reduce((acc, x) => acc + x, 0),
        allocated: gpuNodes.map(x => x.allocated).reduce((acc, x) => acc + x, 0)
      },
      details: {} as { [key: string]: { model: string; ram: string; interface: string; allocatable: number; allocated: number }[] }
    }
  };

  for (const gpuNode of gpuNodes) {
    const vendorName = gpuNode.vendor ?? "<UNKNOWN>";
    if (!(vendorName in response.gpus.details)) {
      response.gpus.details[vendorName] = [];
    }

    const existing = response.gpus.details[vendorName].find(
      x => x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
    );

    if (existing) {
      existing.allocatable += gpuNode.allocatable;
      existing.allocated += gpuNode.allocated;
    } else {
      response.gpus.details[vendorName].push({
        model: gpuNode.modelName,
        ram: gpuNode.memorySize,
        interface: gpuNode.interface,
        allocatable: gpuNode.allocatable,
        allocated: gpuNode.allocated
      });
    }
  }

  return c.json(response);
});
