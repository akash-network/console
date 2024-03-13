import { Block } from "@shared/dbSchemas";
import { Lease, Provider } from "@shared/dbSchemas/akash";
import { chainDb } from "@src/db/dbConnection";
import { isValidBech32Address } from "@src/utils/addresses";
import { round } from "@src/utils/math";
import { differenceInSeconds } from "date-fns";
import { Hono } from "hono";
import * as semver from "semver";
import { Op, QueryTypes } from "sequelize";

export const internalRouter = new Hono();

internalRouter.get("/provider-versions", async (c) => {
  const providers = await Provider.findAll({
    attributes: ["hostUri", "akashVersion"],
    where: {
      isOnline: true
    },
    group: ["hostUri", "akashVersion"]
  });

  const grouped: { version: string; providers: string[] }[] = [];

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
    }, {});

  return c.json(sorted);
});

internalRouter.get("/gpu", async (c) => {
  const provider = c.req.query("provider");
  const vendor = c.req.query("vendor");
  const model = c.req.query("model");
  const memory_size = c.req.query("memory_size");

  let provider_address = null;
  let provider_hosturi = null;

  if (provider) {
    if (isValidBech32Address(provider)) {
      provider_address = provider;
    } else if (URL.canParse(provider)) {
      provider_hosturi = provider;
    } else {
      return c.json({ error: "Invalid provider parameter, should be a valid akash address or host uri" }, 400);
    }
  }

  const gpuNodes = (await chainDb.query(
    `
    WITH snapshots AS (
      SELECT DISTINCT ON("hostUri") 
      ps.id AS id,
      "hostUri", 
      p."owner"
      FROM provider p
      INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSnapshotId"
      WHERE p."isOnline" IS TRUE
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
        provider_hosturi: provider_hosturi ?? null
      }
    }
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

  for (const gpuNode of gpuNodes) {
    const vendorName = gpuNode.vendor ?? "<UNKNOWN>";
    if (!(vendorName in response.gpus.details)) {
      response.gpus.details[vendorName] = [];
    }

    const existing = response.gpus.details[vendorName].find(
      (x) => x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
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

internalRouter.get("leases-duration/:owner", async (c) => {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

  let startTime: Date = new Date("2000-01-01");
  let endTime: Date = new Date("2100-01-01");

  const { dseq, startDate, endDate } = c.req.query();

  if (dseq && isNaN(parseInt(dseq))) {
    return c.text("Invalid dseq", 400);
  }

  if (startDate) {
    if (!startDate.match(dateFormat)) return c.text("Invalid start date, must be in the following format: YYYY-MM-DD", 400);

    const startMs = Date.parse(startDate);

    if (isNaN(startMs)) return c.text("Invalid start date", 400);

    startTime = new Date(startMs);
  }

  if (endDate) {
    if (!endDate.match(dateFormat)) return c.text("Invalid end date, must be in the following format: YYYY-MM-DD", 400);

    const endMs = Date.parse(endDate);

    if (isNaN(endMs)) return c.text("Invalid end date", 400);

    endTime = new Date(endMs);
  }

  if (endTime <= startTime) {
    return c.text("End time must be greater than start time", 400);
  }

  const closedLeases = await Lease.findAll({
    where: {
      owner: c.req.param("owner"),
      closedHeight: { [Op.not]: null },
      "$closedBlock.datetime$": { [Op.gte]: startTime, [Op.lte]: endTime },
      ...(dseq ? { dseq: dseq } : {})
    },
    include: [
      { model: Block, as: "createdBlock" },
      { model: Block, as: "closedBlock" }
    ]
  });

  const leases = closedLeases.map((x) => ({
    dseq: x.dseq,
    oseq: x.oseq,
    gseq: x.gseq,
    provider: x.providerAddress,
    startHeight: x.createdHeight,
    startDate: x.createdBlock.datetime,
    closedHeight: x.closedHeight,
    closedDate: x.closedBlock.datetime,
    durationInBlocks: x.closedHeight - x.createdHeight,
    durationInSeconds: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime),
    durationInHours: differenceInSeconds(x.closedBlock.datetime, x.createdBlock.datetime) / 3600
  }));

  const totalSeconds = leases.map((x) => x.durationInSeconds).reduce((a, b) => a + b, 0);

  return c.json({
    leaseCount: leases.length,
    totalDurationInSeconds: totalSeconds,
    totalDurationInHours: totalSeconds / 3600,
    leases
  });
});
