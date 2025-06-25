import type { MsgCreateBid } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { addDays, minutesToSeconds } from "date-fns";
import { injectable } from "tsyringe";

import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { Memoize } from "@src/caching/helpers";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { GpuRepository } from "@src/gpu/repositories/gpu.repository";
import type { GpuBidType, GpuProviderType, GpuWithPricesType, ProviderWithBestBid } from "@src/gpu/types/gpu.type";
import { averageBlockCountInAMonth, averageBlockCountInAnHour } from "@src/utils/constants";
import { env } from "@src/utils/env";
import { average, median, round, weightedAverage } from "@src/utils/math";
import { decodeMsg, uint8arrayToString } from "@src/utils/protobuf";
import { DayRepository } from "../repositories/day.repository";

@injectable()
export class GpuPriceService {
  constructor(
    private readonly gpuRepository: GpuRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly akashBlockRepository: AkashBlockRepository,
    private readonly dayRepository: DayRepository
  ) {}

  /**
   * Get a list of gpu models with their availability and pricing.
   * The prices are derived from recent bids made on the network.
   * This is a temporary solution and should be replaced with a more accurate pricing mechanism once provider pricing becomes queryable.
   */
  @Memoize({ ttlInSeconds: minutesToSeconds(15) })
  async getGpuPrices(debug: boolean) {
    // Get list of GPUs (model,vendor, ram, interface) and their availability
    const gpus = await this.gpuRepository.getGpusForPricing();

    const daysToInclude = 31;

    // Get the height corresponding to the oldest time we want to include
    const firstBlockToUse = await this.akashBlockRepository.getFirstBlockAfter(addDays(new Date(), -daysToInclude));
    if (!firstBlockToUse) {
      throw new Error("No block found");
    }

    // Fetch all deployments with GPU resources created during this period and their related MsgCreateBid messages
    const deployments = await this.deploymentRepository.findAllWithGpuResources(firstBlockToUse.height);

    // Fetch all days for the period to have historical AKT prices
    const days = await this.dayRepository.getDaysAfter(addDays(new Date(), -(daysToInclude + 2)));

    // Decode the MsgCreateBid messages and calculate the hourly and monthly price for each bid
    const gpuBids = deployments
      .flatMap(d =>
        d.relatedMessages.map(x => {
          const day = days.find(day => day.id === x.block.dayId);
          const decodedBid = decodeMsg("/akash.market.v1beta4.MsgCreateBid", x.data) as MsgCreateBid;

          if (!day || !day.aktPrice) return null; // Ignore bids for days where we don't have the AKT price

          if (decodedBid?.price?.denom !== "uakt") return null; // Ignore USDC bids for simplicity

          return {
            height: x.height,
            txHash: x.transaction.hash,
            datetime: x.block.datetime,
            provider: decodedBid.provider,
            aktTokenPrice: day.aktPrice,
            hourlyPrice: this.blockPriceToHourlyPrice(parseFloat(decodedBid.price.amount), day?.aktPrice),
            monthlyPrice: this.blockPriceToMonthlyPrice(parseFloat(decodedBid.price.amount), day?.aktPrice),
            deployment: {
              owner: d.owner,
              cpuUnits: decodedBid.resourcesOffer
                .flatMap(r => (r.resources?.cpu?.units?.val ? parseInt(uint8arrayToString(r.resources.cpu.units.val)) : 0))
                .reduce((a, b) => a + b, 0),
              memoryUnits: decodedBid.resourcesOffer
                .flatMap(r => (r.resources?.memory?.quantity?.val ? parseInt(uint8arrayToString(r.resources.memory.quantity.val)) : 0))
                .reduce((a, b) => a + b, 0),
              storageUnits: decodedBid.resourcesOffer
                .flatMap(r => r.resources?.storage)
                .map(s => (s?.quantity?.val ? parseInt(uint8arrayToString(s.quantity.val)) : 0))
                .reduce((a, b) => a + b, 0),
              gpus: decodedBid.resourcesOffer
                .filter(x => (x.resources?.gpu?.units?.val ? parseInt(uint8arrayToString(x.resources.gpu.units.val)) : 0) > 0)
                .flatMap(r => (r.resources?.gpu?.attributes ? this.getGpusFromAttributes(r.resources.gpu.attributes) : []))
            },
            data: decodedBid
          };
        })
      )
      .filter(x => x)
      .filter(x => x?.deployment?.gpus?.length === 1) as GpuBidType[]; // Ignore bids for deployments with more than 1 GPU

    const gpuModels: GpuWithPricesType[] = gpus.map(x => ({ ...x, prices: [] as GpuBidType[] }));

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

            const pricingBotAddress = env.PRICING_BOT_ADDRESS;
            const bidsFromPricingBot = providerBids.filter(x => x.deployment.owner === pricingBotAddress && x.deployment.cpuUnits === 100);

            let bestBid = null;
            if (bidsFromPricingBot.length > 0) {
              bestBid = bidsFromPricingBot.sort((a, b) => b.height - a.height)[0];
            } else {
              bestBid = this.findBestProviderBid(providerBidsLast14d, x) ?? this.findBestProviderBid(providerBids, x);
            }

            return {
              provider: p,
              bestBid: bestBid
            };
          })
          .filter(x => x.bestBid) as ProviderWithBestBid[];

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
          price: this.getPricing(providersWithBestBid),
          bidCount: debug ? x.prices.length : undefined,
          providersWithBestBid: debug ? providersWithBestBid : undefined
        };
      })
    };
  }

  private getPricing(
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

  private findBestProviderBid(providerBids: GpuBidType[], gpuModel: GpuWithPricesType) {
    const providerBidsWithRamAndInterface = providerBids.filter(
      b => b.deployment.gpus[0].ram === gpuModel.ram && this.isInterfaceMatching(gpuModel.interface, b.deployment.gpus[0].interface)
    );

    if (providerBidsWithRamAndInterface.length > 0) return providerBidsWithRamAndInterface.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

    const providerBidsWithRam = providerBids.filter(b => b.deployment.gpus[0].ram === gpuModel.ram);

    if (providerBidsWithRam.length > 0) return providerBidsWithRam.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];

    if (providerBids.length > 0) return providerBids.sort((a, b) => a.hourlyPrice - b.hourlyPrice)[0];
  }

  private isInterfaceMatching(gpuInterface: string, bidInterface: string) {
    return (
      bidInterface &&
      (gpuInterface.toLowerCase() === bidInterface.toLowerCase() || (gpuInterface.toLowerCase().startsWith("sxm") && bidInterface.toLowerCase() === "sxm"))
    );
  }

  private getGpusFromAttributes(attributes: { key: string; value: string }[]) {
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

  private blockPriceToMonthlyPrice(uaktPerBlock: number, aktPrice: number) {
    return round((averageBlockCountInAMonth * uaktPerBlock * aktPrice) / 1_000_000, 2);
  }

  private blockPriceToHourlyPrice(uaktPerBlock: number, aktPrice: number) {
    return round((averageBlockCountInAnHour * uaktPerBlock * aktPrice) / 1_000_000, 2);
  }
}
