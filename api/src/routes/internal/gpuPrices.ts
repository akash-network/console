import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Block } from "@shared/dbSchemas";
import { AkashMessage, Deployment, DeploymentGroup, DeploymentGroupResource } from "@shared/dbSchemas/akash";
import { Day, Transaction } from "@shared/dbSchemas/base";
import { cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { MsgCreateBid } from "@src/proto/akash/v1beta4";
import { averageBlockCountInAMonth, averageBlockCountInAnHour } from "@src/utils/constants";
import { round } from "@src/utils/math";
import { decodeMsg, uint8arrayToString } from "@src/utils/protobuf";
import { addDays } from "date-fns";
import { Op, QueryTypes } from "sequelize";

const route = createRoute({
  method: "get",
  path: "/gpu-prices",
  summary: "Get a list of gpu models with their availability and pricing.",
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

export default new OpenAPIHono().openapi(route, async (c) => {
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
    .flatMap((d) =>
      d.relatedMessages.map((x) => {
        const day = days.find((d) => d.id === x.block.dayId);
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
    .filter((x) => x)
    .filter((x) => x.deployment.gpus.length === 1); // Ignore bids for deployments with more than 1 GPU

  const gpuModels: GpuWithPricesType[] = gpus.map((x) => ({ ...x, prices: [] }));

  // Add bids to their corresponding GPU models
  for (const bid of gpuBids) {
    const gpu = bid.deployment.gpus[0];
    const matchingGpuModels = gpuModels.filter((x) => x.vendor === gpu.vendor && x.model === gpu.model);

    for (const gpuModel of matchingGpuModels) {
      gpuModel.prices.push(bid);
    }
  }

  // Sort GPUs by vendor, model, ram, interface
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
    models: gpuModels.map((x) => {
      x.prices.sort((a, b) => a.hourlyPrice - b.hourlyPrice);

      /* 
        For each providers get their most relevent bid based on this order of priority:
            1- Most recent bid from the pricing bot (those deployment have tiny cpu/ram/storage specs to improve gpu price accuracy)
            2- Cheapest bid with matching ram and interface
            3- Cheapest bid with matching ram
            4- Cheapest remaining bid
            5- If no bids are found, increase search range from 14 to 31 days and repeat steps 2-4
      */
      const bestProviderBids = x.providers
        .map((p) => {
          const providerBids = x.prices.filter((b) => b.provider === p.owner);
          const providerBidsLast14d = providerBids.filter((x) => x.datetime > addDays(new Date(), -14));

          const pricingBotAddress = "akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf";
          const bidsFromPricingBot = providerBids.filter((x) => x.deployment.owner === pricingBotAddress && x.deployment.cpuUnits === 100);

          if (bidsFromPricingBot.length > 0) return bidsFromPricingBot.sort((a, b) => b.height - a.height)[0];

          return findBestProviderBid(providerBidsLast14d, x) ?? findBestProviderBid(providerBids, x);
        })
        .filter((x) => x)
        .sort((a, b) => a.hourlyPrice - b.hourlyPrice);

      // Sort provider bids by price for the median calculation
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
          currency: "USD",
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

function findBestProviderBid(providerBids: GpuBidType[], gpuModel: GpuWithPricesType) {
  const providerBidsWithRamAndInterface = providerBids.filter(
    (b) => b.deployment.gpus[0].ram === gpuModel.ram && isInterfaceMatching(gpuModel.interface, b.deployment.gpus[0].interface)
  );

  if (providerBidsWithRamAndInterface.length > 0) return providerBidsWithRamAndInterface.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

  const providerBidsWithRam = providerBids.filter((b) => b.deployment.gpus[0].ram === gpuModel.ram);

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
    .filter((attr) => attr.key.startsWith("vendor/") && attr.value === "true")
    .map((attr) => {
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
