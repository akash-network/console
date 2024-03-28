import { MsgCreateBid } from "@akashnetwork/akashjs/build/protobuf/akash/market/v1beta4/bid";
import { Block } from "@shared/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource, Lease, Provider } from "@shared/dbSchemas/akash";
import { Day, Transaction } from "@shared/dbSchemas/base";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { GpuVendor, ProviderConfigGpusType } from "@src/types/gpu";
import { isValidBech32Address } from "@src/utils/addresses";
import { averageBlockCountInAMonth, averageBlockCountInAnHour } from "@src/utils/constants";
import { round } from "@src/utils/math";
import axios from "axios";
import { decodeMsg, uint8arrayToString } from "@src/utils/protobuf";
import { addDays, differenceInSeconds } from "date-fns";
import { Hono } from "hono";
import * as semver from "semver";
import { Op, QueryTypes } from "sequelize";
import { getGpuInterface } from "@src/utils/gpu";

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
    .reduce(
      (acc, x) => {
        acc[x.version] = x;
        return acc;
      },
      {} as { [key: string]: (typeof results)[number] }
    );

  return c.json(sorted);
});

internalRouter.get("/gpu", async (c) => {
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
  );

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

internalRouter.get("gpu-models", async (c) => {
  const response = await cacheResponse(60 * 2, cacheKeys.getGpuModels, async () => {
    const res = await axios.get<ProviderConfigGpusType>("https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie/gpus.json");
    return res.data;
  });

  const gpuModels: GpuVendor[] = [];

  // Loop over vendors
  for (const [, vendorValue] of Object.entries(response)) {
    const vendor: GpuVendor = {
      name: vendorValue.name,
      models: []
    };

    // Loop over models
    for (const [, modelValue] of Object.entries(vendorValue.devices)) {
      const _modelValue = modelValue as {
        name: string;
        memory_size: string;
        interface: string;
      };
      const existingModel = vendor.models.find((x) => x.name === _modelValue.name);

      if (existingModel) {
        if (!existingModel.memory.includes(_modelValue.memory_size)) {
          existingModel.memory.push(_modelValue.memory_size);
        }
        if (!existingModel.interface.includes(getGpuInterface(_modelValue.interface))) {
          existingModel.interface.push(getGpuInterface(_modelValue.interface));
        }
      } else {
        vendor.models.push({
          name: _modelValue.name,
          memory: [_modelValue.memory_size],
          interface: [getGpuInterface(_modelValue.interface)]
        });
      }
    }

    gpuModels.push(vendor);
  }

  return c.json(gpuModels);
});

internalRouter.get("gpu-prices", async (c) => {
  const debug = c.req.query("debug") === "true";
  console.time("gpu prices");
  const gpuPrices = await cacheResponse(15 * 60, debug ? "gpu-prices-debug" : "gpu-prices", () => getGpuPrices(debug), true);
  //const gpuPrices = await getGpuPrices(debug);
  console.timeEnd("gpu prices");

  return c.json(gpuPrices);
});

async function getGpuPrices(debug: boolean) {
  const gpus = await getGpus();

  const daysToInclude = 14;

  const minHeight = (await Block.findOne({ where: { datetime: { [Op.gte]: addDays(new Date(), -daysToInclude) } }, order: ["datetime"] })).height;

  const deployments = await Deployment.findAll({
    attributes: ["id", "owner"],
    where: { createdHeight: { [Op.gte]: minHeight } },
    include: [
      {
        model: DeploymentGroup,
        required: true,
        include: [{ model: DeploymentGroupResource, required: true, where: { gpuUnits: 1 } }]
      },
      {
        model: AkashMessage,
        as: "relatedMessages",
        where: {
          type: "/akash.market.v1beta4.MsgCreateBid"
        },
        include: [
          { model: Block, attributes: ["height", "dayId", "datetime"] },
          { model: Transaction, attributes: ["hash"] }
        ]
      }
    ]
  });

  const days = await Day.findAll({ where: { date: { [Op.gte]: addDays(new Date(), -(daysToInclude + 2)) } } });

  const gpuBids = deployments
    .flatMap((d) =>
      d.relatedMessages.map((x) => {
        const day = days.find((d) => d.id === x.block.dayId);
        const decodedBid = decodeMsg("/akash.market.v1beta4.MsgCreateBid", x.data) as MsgCreateBid;

        if (!day.aktPrice) return null;

        if (decodedBid.price.denom !== "uakt") return null; // TODO handle usdc

        return {
          height: x.height,
          txHash: x.transaction.hash,
          datetime: x.block.datetime,
          provider: decodedBid.provider,
          aktTokenPrice: day?.aktPrice, // TODO Handle no price,
          hourlyPrice: blockPriceToHourlyPrice(parseFloat(decodedBid.price.amount), day?.aktPrice),
          deployment: {
            owner: d.owner,
            cpuUnits: decodedBid.resourcesOffer.flatMap((r) => parseInt(uint8arrayToString(r.resources.cpu.units.val))).reduce((a, b) => a + b, 0),
            memoryUnits: decodedBid.resourcesOffer.flatMap((r) => parseInt(uint8arrayToString(r.resources.memory.quantity.val))).reduce((a, b) => a + b, 0),
            storageUnits: decodedBid.resourcesOffer
              .flatMap((r) => r.resources.storage)
              .map((s) => parseInt(uint8arrayToString(s.quantity.val)))
              .reduce((a, b) => a + b, 0),
            gpus: decodedBid.resourcesOffer
              .filter((x) => parseInt(uint8arrayToString(x.resources.gpu.units.val)) > 0)
              .flatMap((r) => getGpusFromAttributes(r.resources.gpu.attributes))
          },
          data: decodedBid
        };
      })
    )
    .filter((x) => x);

  type GpuWithPricesType = GpuType & {
    prices: (typeof gpuBids)[number][];
  };

  const gpuModels: GpuWithPricesType[] = gpus.map((x) => ({ ...x, prices: [] }));

  for (const bid of gpuBids.filter((x) => x.deployment.gpus.length === 1)) {
    // TODO: check count
    const gpu = bid.deployment.gpus[0];
    const matchingGpuModels = gpuModels.filter((x) => x.vendor === gpu.vendor && x.model === gpu.model);

    for (const gpuModel of matchingGpuModels) {
      gpuModel.prices.push(bid);
    }
  }

  // Sort by vendor, model, ram, interface
  gpuModels.sort(
    (a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
  );

  const totalAllocatable = gpuModels.map((x) => x.allocatable).reduce((a, b) => a + b, 0);
  const totalAllocated = gpuModels.map((x) => x.allocated).reduce((a, b) => a + b, 0);

  return {
    availability: {
      total: totalAllocatable,
      available: totalAllocatable - totalAllocated
    },
    models: gpuModels
      //.filter((x) => x.model === "h100" && x.ram === "80Gi" && x.interface === "SXM5")
      .map((x) => {
        x.prices.sort((a, b) => a.hourlyPrice - b.hourlyPrice);

        const bestProviderBids = x.providers
          .map((p) => {
            // TODO : check for ram and interface
            const providerBids = x.prices.filter((b) => b.provider === p.owner);

            const bidsFromBot = providerBids.filter(
              (x) => x.deployment.owner === "akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf" && x.deployment.cpuUnits === 100
            );
            if (bidsFromBot.length > 0) return bidsFromBot.sort((a, b) => b.height - a.height)[0];

            const providerBidsWithRamAndInterface = providerBids.filter(
              (b) => b.deployment.gpus[0].ram === x.ram && isInterfaceMatching(x.interface, b.deployment.gpus[0].interface)
            );

            if (providerBidsWithRamAndInterface.length > 0) return providerBidsWithRamAndInterface.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

            const providerBidsWithRam = providerBids.filter((b) => b.deployment.gpus[0].ram === x.ram);

            if (providerBidsWithRam.length > 0) return providerBidsWithRam.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

            if (providerBids.length > 0) return providerBids.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];
          })
          .filter((x) => x)
          .sort((a, b) => a.hourlyPrice - b.hourlyPrice);

        const sortedPrices = bestProviderBids.map((x) => x.hourlyPrice);

        return {
          vendor: x.vendor,
          model: x.model,
          ram: x.ram,
          interface: x.interface,
          availability: {
            total: x.allocatable,
            available: x.allocatable - x.allocated
          },
          providerAvailability: {
            total: x.providers.length,
            available: x.availableProviders.length,
            providers: debug ? x.providers : undefined
          },
          price: {
            min: Math.min(...sortedPrices),
            max: Math.max(...sortedPrices),
            avg: round(sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length, 2),
            med: sortedPrices[Math.floor(sortedPrices.length / 2)]
          },
          bidCount: debug ? x.prices.length : undefined,
          bids: debug ? x.prices : undefined,
          bestProviderBids: debug ? bestProviderBids : undefined
        };
      })
  };
}

export function isInterfaceMatching(gpuInterface: string, bidInterface: string) {
  return (
    bidInterface &&
    (gpuInterface.toLowerCase() === bidInterface.toLowerCase() || (gpuInterface.toLowerCase().startsWith("sxm") && bidInterface.toLowerCase() === "sxm"))
  );
}

export function getGpusFromAttributes(attributes: { key: string; value: string }[]) {
  return attributes
    .filter((attr) => attr.key.startsWith("vendor/") && attr.value === "true")
    .map((attr) => {
      const vendor = /vendor\/([^\/]+)/.exec(attr.key)?.[1];
      const model = /model\/([^\/]+)/.exec(attr.key)?.[1];
      const ram = /ram\/([^\/]+)/.exec(attr.key)?.[1];
      const int = /interface\/([^\/]+)/.exec(attr.key)?.[1];

      // vendor/nvidia/model/h100 -> nvidia,h100
      return { vendor: vendor, model: model, ram: ram, interface: int };
    });
}

function blockPriceToMonthlyPrice(uaktPerBlock: number, aktPrice: number) {
  return round((averageBlockCountInAMonth * uaktPerBlock * aktPrice) / 1_000_000, 2);
}

function blockPriceToHourlyPrice(uaktPerBlock: number, aktPrice: number) {
  return round((averageBlockCountInAnHour * uaktPerBlock * aktPrice) / 1_000_000, 2);
}

async function getGpus() {
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
      INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSnapshotId"
      WHERE p."isOnline" IS TRUE
    )
    SELECT s."hostUri", s."owner", n."name", n."gpuAllocatable" AS allocatable, n."gpuAllocated" AS allocated, gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
    FROM snapshots s
    INNER JOIN "providerSnapshotNode" n ON n."snapshotId"=s.id AND n."gpuAllocatable" > 0
    LEFT JOIN (
      SELECT DISTINCT ON (gpu."snapshotNodeId") gpu.*
      FROM "providerSnapshotNodeGPU" gpu
    ) gpu ON gpu."snapshotNodeId" = n.id
    WHERE
      gpu.vendor IS NOT NULL
`,
    {
      type: QueryTypes.SELECT
    }
  );

  const gpus: GpuType[] = [];

  for (const gpuNode of gpuNodes) {
    const existing = gpus.find(
      (x) => x.vendor === gpuNode.vendor && x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
    );

    if (existing) {
      existing.allocatable += gpuNode.allocatable;
      existing.allocated += gpuNode.allocated;

      if (!existing.providers.some((p) => p.hostUri === gpuNode.hostUri)) {
        existing.providers.push({ owner: gpuNode.owner, hostUri: gpuNode.hostUri });
      }
      if (gpuNode.allocated < gpuNode.allocatable && !existing.availableProviders.some((p) => p.hostUri === gpuNode.hostUri)) {
        existing.availableProviders.push({ owner: gpuNode.owner, hostUri: gpuNode.hostUri });
      }
    } else {
      gpus.push({
        vendor: gpuNode.vendor,
        model: gpuNode.modelName,
        ram: gpuNode.memorySize,
        interface: gpuNode.interface,
        allocatable: gpuNode.allocatable,
        allocated: gpuNode.allocated,
        providers: [{ owner: gpuNode.owner, hostUri: gpuNode.hostUri }],
        availableProviders: gpuNode.allocated < gpuNode.allocatable ? [{ owner: gpuNode.owner, hostUri: gpuNode.hostUri }] : []
      });
    }
  }

  return gpus;
}

type GpuType = {
  vendor: string;
  model: string;
  interface: string;
  ram: string;
  allocatable: number;
  allocated: number;
  providers: { owner: string; hostUri: string }[];
  availableProviders: { owner: string; hostUri: string }[];
};
