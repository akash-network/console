import { Provider, ProviderSnapshot } from "@shared/dbSchemas/akash";
import { chainDb } from "@src/db/dbConnection";
import { round } from "@src/utils/math";
import { Hono } from "hono";
import * as semver from "semver";
import { QueryTypes } from "sequelize";

export const internalRouter = new Hono();

internalRouter.get("/provider-versions", async (c) => {
  const providers = await Provider.findAll({
    attributes: ["hostUri", "akashVersion"],
    where: {
      isOnline: true
    },
    group: ["hostUri", "akashVersion"]
  });

  let grouped: { version: string; providers: string[] }[] = [];

  for (const provider of providers) {
    const existing = grouped.find((x) => x.version === provider.akashVersion);

    if (existing) {
      existing.providers.push(provider.hostUri);
    } else {
      grouped.push({
        version: provider.akashVersion,
        providers: [provider.hostUri]
      });
    }
  }

  const nullVersionName = "<UNKNOWN>";
  const results = grouped.map((x) => ({
    version: x.version ?? nullVersionName,
    count: x.providers.length,
    ratio: round(x.providers.length / providers.length, 2),
    providers: Array.from(new Set(x.providers))
  }));

  const sorted = results
    .filter((x) => x.version !== nullVersionName) // Remove <UNKNOWN> version for sorting
    .sort((a, b) => semver.compare(b.version, a.version))
    .concat(results.filter((x) => x.version === nullVersionName)) // Add back <UNKNOWN> version at the end
    .reduce((acc, x) => {
      acc[x.version] = x;
      return acc;
    }, {} as any);

  return c.json(sorted);
});

internalRouter.get("/gpu-models", async (c) => {
  const gpuNodes = (await chainDb.query(
    `
    WITH nodes AS (
      SELECT DISTINCT ON("hostUri") 
        "hostUri", 
        psn.id AS "id", 
        name,
        "gpuAllocatable" AS "allocatable",
        "gpuAllocated" AS "allocated"
      FROM provider p
      INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSnapshotId"
      INNER JOIN "providerSnapshotNode" psn ON psn."snapshotId"=ps.id
      WHERE p."isOnline" IS TRUE
    )
    SELECT n."hostUri", n."name", n."allocatable", n."allocated", gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
    FROM nodes n
    LEFT JOIN (
      SELECT DISTINCT ON (gpu."snapshotNodeId") gpu.*
      FROM "providerSnapshotNodeGPU" gpu
    ) gpu ON gpu."snapshotNodeId" = n.id
    
`,
    { type: QueryTypes.SELECT }
  )) as {
    hostUri: string;
    name: string;
    allocatable: number;
    allocated: number;
    modelId: string;
    vendor: string;
    modelName: string;
    interface: string;
    memorySize: string;
  }[];

  const response = {
    gpus: {
      total: {
        allocatable: gpuNodes.map((x) => x.allocatable).reduce((acc, x) => acc + x, 0),
        allocated: gpuNodes.map((x) => x.allocated).reduce((acc, x) => acc + x, 0)
      },
      details: {} as { [key: string]: { model: string; ram: string; interface: string; allocatable: number; allocated: number }[] }
    }
  };

  for (const gpuNode of gpuNodes.filter((x) => x.vendor)) {
    if (!(gpuNode.vendor in response.gpus.details)) {
      response.gpus.details[gpuNode.vendor] = [];
    }

    const existing = response.gpus.details[gpuNode.vendor].find(
      (x) => x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
    );

    if (existing) {
      existing.allocatable += gpuNode.allocatable;
      existing.allocated += gpuNode.allocated;
    } else {
      response.gpus.details[gpuNode.vendor].push({
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
