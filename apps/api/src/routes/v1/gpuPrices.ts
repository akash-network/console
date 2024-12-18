import { MsgCreateBid } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { Block } from "@akashnetwork/database/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource } from "@akashnetwork/database/dbSchemas/akash";
import { Day, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { addDays, sub } from "date-fns";
import { Op, QueryTypes } from "sequelize";

import { cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { toUTC } from "@src/utils";
import { averageBlockCountInAMonth, averageBlockCountInAnHour } from "@src/utils/constants";
import { env } from "@src/utils/env";
import { average, median, round, weightedAverage } from "@src/utils/math";
import { decodeMsg, uint8arrayToString } from "@src/utils/protobuf";

const route = createRoute({
  method: "get",
  path: "/gpu-prices",
  summary: "Get a list of gpu models with their availability and pricing.",
  tags: ["Gpu"],
  responses: {
    200: {
      description: "List of gpu models with their availability and pricing.",
      content: {
        "application/json": {
          schema: z.object({
            availability: z.object({
              total: z.number(),
              available: z.number()
            }),
            models: z.array(
              z.object({
                vendor: z.string(),
                model: z.string(),
                ram: z.string(),
                interface: z.string(),
                availability: z.object({
                  total: z.number(),
                  available: z.number()
                }),
                providerAvailability: z.object({
                  total: z.number(),
                  available: z.number()
                }),
                price: z.object({
                  currency: z.string().openapi({ example: "USD" }),
                  min: z.number(),
                  max: z.number(),
                  avg: z.number(),
                  weightedAverage: z.number(),
                  med: z.number()
                })
              })
            )
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const debug = c.req.query("debug") === "true";

  console.time("gpu prices");

  let gpuPrices = null;
  if (debug) {
    gpuPrices = await getGpuPrices(true);
  } else {
    gpuPrices = await cacheResponse(15 * 60, "gpu-prices", () => getGpuPrices(false), true);
  }

  console.timeEnd("gpu prices");

  return c.json(gpuPrices);
});

type GpuBidType = {
  height: number;
  txHash: string;
  datetime: Date;
  provider: string;
  aktTokenPrice: number;
  hourlyPrice: number;
  monthlyPrice: number;
  deployment: {
    owner: string;
    cpuUnits: number;
    memoryUnits: number;
    storageUnits: number;
    gpus: {
      vendor: string;
      model: string;
      ram: string;
      interface: string;
    }[];
  };
  data: MsgCreateBid;
};

type GpuWithPricesType = GpuType & {
  prices: GpuBidType[];
};

/**
 * Get a list of gpu models with their availability and pricing.
 * The prices are derived from recent bids made on the network.
 * This is a temporary solution and should be replaced with a more accurate pricing mechanism once provider pricing becomes queryable.
 */
async function getGpuPrices(debug: boolean) {
  // Get list of GPUs (model,vendor, ram, interface) and their availability
  const gpus = await getGpus();

  const daysToInclude = 31;

  // Get the height corresponding to the oldest time we want to include
  const minHeight = (await Block.findOne({ where: { datetime: { [Op.gte]: addDays(new Date(), -daysToInclude) } }, order: ["datetime"] })).height;

  // Fetch all deployments with GPU resources created during this period and their related MsgCreateBid messages
  const deployments = await Deployment.findAll({
    attributes: ["id", "owner"],
    where: { createdHeight: { [Op.gte]: minHeight } },
    include: [
      {
        attributes: [],
        model: DeploymentGroup,
        required: true,
        include: [
          {
            attributes: [],
            model: DeploymentGroupResource,
            required: true,
            where: { gpuUnits: 1 }
          }
        ]
      },
      {
        attributes: ["height", "data"],
        model: AkashMessage,
        as: "relatedMessages",
        where: {
          type: "/akash.market.v1beta4.MsgCreateBid",
          height: { [Op.gte]: minHeight }
        },
        include: [
          { model: Block, attributes: ["height", "dayId", "datetime"], required: true },
          { model: Transaction, attributes: ["hash"], required: true }
        ]
      }
    ]
  });

  // Fetch all days for the period to have historical AKT prices
  const days = await Day.findAll({ where: { date: { [Op.gte]: addDays(new Date(), -(daysToInclude + 2)) } } });

  // Decode the MsgCreateBid messages and calculate the hourly and monthly price for each bid
  const gpuBids: GpuBidType[] = deployments
    .flatMap(d =>
      d.relatedMessages.map(x => {
        const day = days.find(day => day.id === x.block.dayId);
        const decodedBid = decodeMsg("/akash.market.v1beta4.MsgCreateBid", x.data) as MsgCreateBid;

        if (!day || !day.aktPrice) return null; // Ignore bids for days where we don't have the AKT price

        if (decodedBid.price.denom !== "uakt") return null; // Ignore USDC bids for simplicity

        return {
          height: x.height,
          txHash: x.transaction.hash,
          datetime: x.block.datetime,
          provider: decodedBid.provider,
          aktTokenPrice: day.aktPrice,
          hourlyPrice: blockPriceToHourlyPrice(parseFloat(decodedBid.price.amount), day?.aktPrice),
          monthlyPrice: blockPriceToMonthlyPrice(parseFloat(decodedBid.price.amount), day?.aktPrice),
          deployment: {
            owner: d.owner,
            cpuUnits: decodedBid.resourcesOffer.flatMap(r => parseInt(uint8arrayToString(r.resources.cpu.units.val))).reduce((a, b) => a + b, 0),
            memoryUnits: decodedBid.resourcesOffer.flatMap(r => parseInt(uint8arrayToString(r.resources.memory.quantity.val))).reduce((a, b) => a + b, 0),
            storageUnits: decodedBid.resourcesOffer
              .flatMap(r => r.resources.storage)
              .map(s => parseInt(uint8arrayToString(s.quantity.val)))
              .reduce((a, b) => a + b, 0),
            gpus: decodedBid.resourcesOffer
              .filter(x => parseInt(uint8arrayToString(x.resources.gpu.units.val)) > 0)
              .flatMap(r => getGpusFromAttributes(r.resources.gpu.attributes))
          },
          data: decodedBid
        };
      })
    )
    .filter(x => x)
    .filter(x => x.deployment.gpus.length === 1); // Ignore bids for deployments with more than 1 GPU

  const gpuModels: GpuWithPricesType[] = gpus.map(x => ({ ...x, prices: [] }));

  // Add bids to their corresponding GPU models
  for (const bid of gpuBids) {
    const gpu = bid.deployment.gpus[0];
    const matchingGpuModels = gpuModels.filter(x => x.vendor === gpu.vendor && x.model === gpu.model);

    for (const gpuModel of matchingGpuModels) {
      gpuModel.prices.push(bid);
    }
  }

  // Sort GPUs by vendor, model, ram, interface
  gpuModels.sort(
    (a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
  );

  const totalAllocatable = gpuModels.map(x => x.allocatable).reduce((a, b) => a + b, 0);
  const totalAllocated = gpuModels.map(x => x.allocated).reduce((a, b) => a + b, 0);

  return {
    availability: {
      total: totalAllocatable,
      available: totalAllocatable - totalAllocated
    },
    models: gpuModels.map(x => {
      /* 
        For each providers get their most relevent bid based on this order of priority:
            1- Most recent bid from the pricing bot (those deployment have tiny cpu/ram/storage specs to improve gpu price accuracy)
            2- Cheapest bid with matching ram and interface
            3- Cheapest bid with matching ram
            4- Cheapest remaining bid
            5- If no bids are found, increase search range from 14 to 31 days and repeat steps 2-4
      */
      const providersWithBestBid = x.providers
        .map(p => {
          const providerBids = x.prices.filter(b => b.provider === p.owner);
          const providerBidsLast14d = providerBids.filter(x => x.datetime > addDays(new Date(), -14));

          const pricingBotAddress = "akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf";
          const bidsFromPricingBot = providerBids.filter(x => x.deployment.owner === pricingBotAddress && x.deployment.cpuUnits === 100);

          let bestBid = null;
          if (bidsFromPricingBot.length > 0) {
            bestBid = bidsFromPricingBot.sort((a, b) => b.height - a.height)[0];
          } else {
            bestBid = findBestProviderBid(providerBidsLast14d, x) ?? findBestProviderBid(providerBids, x);
          }

          return {
            provider: p,
            bestBid: bestBid
          };
        })
        .filter(x => x.bestBid);

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
        price: getPricing(providersWithBestBid),
        bidCount: debug ? x.prices.length : undefined,
        providersWithBestBid: debug ? providersWithBestBid : undefined
      };
    })
  };
}

function getPricing(
  providersWithBestBid: {
    provider: GpuProviderType;
    bestBid: GpuBidType;
  }[]
) {
  try {
    if (!providersWithBestBid || providersWithBestBid.length === 0) return null;

    const prices = providersWithBestBid.map(x => x.bestBid.hourlyPrice);

    return {
      currency: "USD",
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: round(average(prices), 2),
      weightedAverage: round(weightedAverage(providersWithBestBid.map(p => ({ value: p.bestBid.hourlyPrice, weight: p.provider.allocatable }))), 2),
      med: round(median(prices), 2)
    };
  } catch (e) {
    console.error("Error calculating pricing", e);
    return null;
  }
}

function findBestProviderBid(providerBids: GpuBidType[], gpuModel: GpuWithPricesType) {
  const providerBidsWithRamAndInterface = providerBids.filter(
    b => b.deployment.gpus[0].ram === gpuModel.ram && isInterfaceMatching(gpuModel.interface, b.deployment.gpus[0].interface)
  );

  if (providerBidsWithRamAndInterface.length > 0) return providerBidsWithRamAndInterface.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

  const providerBidsWithRam = providerBids.filter(b => b.deployment.gpus[0].ram === gpuModel.ram);

  if (providerBidsWithRam.length > 0) return providerBidsWithRam.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

  if (providerBids.length > 0) return providerBids.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];
}

export function isInterfaceMatching(gpuInterface: string, bidInterface: string) {
  return (
    bidInterface &&
    (gpuInterface.toLowerCase() === bidInterface.toLowerCase() || (gpuInterface.toLowerCase().startsWith("sxm") && bidInterface.toLowerCase() === "sxm"))
  );
}

export function getGpusFromAttributes(attributes: { key: string; value: string }[]) {
  return attributes
    .filter(attr => attr.key.startsWith("vendor/") && attr.value === "true")
    .map(attr => {
      const vendor = /vendor\/([^/]+)/.exec(attr.key)?.[1];
      const model = /model\/([^/]+)/.exec(attr.key)?.[1];
      const ram = /ram\/([^/]+)/.exec(attr.key)?.[1];
      const int = /interface\/([^/]+)/.exec(attr.key)?.[1];

      // vendor/nvidia/model/h100/ram/80Gi/interface/pcie -> nvidia,h100,80Gi,pcie
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
        INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSuccessfulSnapshotId"
        WHERE p."isOnline" IS TRUE OR ps."checkDate" >= :grace_date
        ORDER BY p."hostUri", p."createdHeight" DESC
      )
      SELECT s."hostUri", s."owner", n."name", n."gpuAllocatable" AS allocatable, LEAST(n."gpuAllocated", n."gpuAllocatable") AS allocated, gpu."modelId", gpu.vendor, gpu.name AS "modelName", gpu.interface, gpu."memorySize"
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
      type: QueryTypes.SELECT,
      replacements: {
        grace_date: toUTC(sub(new Date(), { minutes: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES }))
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

type GpuType = {
  vendor: string;
  model: string;
  interface: string;
  ram: string;
  allocatable: number;
  allocated: number;
  providers: GpuProviderType[];
  availableProviders: GpuProviderType[];
};

type GpuProviderType = {
  owner: string;
  hostUri: string;
  allocated: number;
  allocatable: number;
};
