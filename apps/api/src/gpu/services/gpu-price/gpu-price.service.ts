import { Day } from "@akashnetwork/database/dbSchemas/base";
import { addDays, minutesToSeconds } from "date-fns";
import { inject, injectable } from "tsyringe";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { Memoize } from "@src/caching/helpers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { blockPriceToUakt, blockPriceToUsd } from "@src/gpu/lib/block-price/block-price";
import { decodeGpuBid } from "@src/gpu/lib/gpu-bid-decoder/gpu-bid-decoder";
import { GpuRepository } from "@src/gpu/repositories/gpu.repository";
import type { GpuBidType, GpuPriceModel, GpuProviderType, GpuWithPricesType, ProviderWithBestBid } from "@src/gpu/types/gpu.type";
import { forEachInChunks } from "@src/utils/array/array";
import { average, median, round, weightedAverage } from "@src/utils/math";
import type { GpuConfig } from "../../config/env.config";
import { GPU_CONFIG } from "../../providers/config.provider";
import { DayRepository } from "../../repositories/day.repository";

/** The cpu of the pricing bot's tiny pricing order; its other check orders carry cpu, memory and storage that would skew their gpu's price. */
const PRICING_BOT_CPU_UNITS = 100;

@injectable()
export class GpuPriceService {
  readonly #gpuConfig: GpuConfig;
  readonly #typeRegistry: Registry;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuRepository: GpuRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly akashBlockRepository: AkashBlockRepository,
    private readonly dayRepository: DayRepository,
    @inject(GPU_CONFIG) gpuConfig: GpuConfig,
    @inject(TYPE_REGISTRY) typeRegistry: Registry,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: GpuPriceService.name });
    this.#gpuConfig = gpuConfig;
    this.#typeRegistry = typeRegistry;
  }

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

    // Fetch all days for the period to have historical AKT prices
    const days = await this.dayRepository.getDaysAfter(addDays(new Date(), -(daysToInclude + 2)));
    const daysById = days.reduce((group, day) => group.set(day.id, day), new Map<string, Day>());

    // Fetch all deployments with GPU resources created during this period and their related MsgCreateBid messages
    const deployments = this.deploymentRepository.findAllWithGpuResources({ minHeight: firstBlockToUse.height });
    const gpuModels: GpuWithPricesType[] = gpus.map(x => ({ ...x, prices: [] as GpuBidType[] }));
    const pricingBotAddress = this.#gpuConfig.PRICING_BOT_ADDRESS;
    const gpusByModelAndVendor = Object.groupBy(gpuModels, x => `${x.vendor}-${x.model}`);

    for await (const d of deployments) {
      // Decode the MsgCreateBid messages and calculate the hourly and monthly price for each bid
      d.relatedMessages.forEach(x => {
        const day = daysById.get(x.block.dayId);

        const decodedBid = decodeGpuBid(this.#typeRegistry, x);
        const isUakt = decodedBid.denom === "uakt";
        const isUact = decodedBid.denom === "uact";

        if (!isUakt && !isUact) return; // Only accept uakt and uact bids
        if (isUakt && (!day || !day.aktPrice)) return; // uakt bids need AKT price for USD conversion

        // Ignore bids for deployments with more than 1 GPU
        if (decodedBid.gpus.length !== 1) return;

        const aktPrice = day?.aktPrice ?? 0;

        const bid = {
          height: x.height,
          txHash: x.transaction.hash,
          datetime: x.block.datetime,
          provider: decodedBid.provider,
          aktTokenPrice: aktPrice,
          hourlyPrice: blockPriceToUsd(decodedBid, aktPrice, "hour"),
          monthlyPrice: blockPriceToUsd(decodedBid, aktPrice, "month"),
          hourlyPriceUakt: blockPriceToUakt(decodedBid, aktPrice, "hour"),
          monthlyPriceUakt: blockPriceToUakt(decodedBid, aktPrice, "month"),
          deployment: {
            owner: d.owner,
            cpuUnits: decodedBid.cpuUnits,
            memoryUnits: decodedBid.memoryUnits,
            storageUnits: decodedBid.storageUnits,
            gpus: decodedBid.gpus
          },
          data: decodedBid.json
        } as GpuBidType;

        if (bid.deployment.owner === pricingBotAddress && bid.deployment.cpuUnits !== PRICING_BOT_CPU_UNITS) return;

        const gpu = bid.deployment.gpus[0];
        const matchingGpuModels = gpusByModelAndVendor[`${gpu.vendor}-${gpu.model}`];
        if (!matchingGpuModels) return;

        // Add bids to their corresponding GPU models
        for (const gpuModel of matchingGpuModels) {
          gpuModel.prices.push(bid);
        }
      });
    }

    // Sort GPUs by vendor, model, ram, interface
    gpuModels.sort(
      (a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
    );

    let totalAllocatable = 0;
    let totalAllocated = 0;
    const models: GpuPriceModel[] = [];
    await forEachInChunks(gpuModels, async x => {
      totalAllocatable += x.allocatable;
      totalAllocated += x.allocated;
      /*
        For each providers get their most relevant bid based on this order of priority:
            1- Most recent bid from the pricing bot (those deployment have tiny cpu/ram/storage specs to improve gpu price accuracy)
            2- Cheapest bid with matching ram and interface
            3- Cheapest bid with matching ram
            4- Cheapest remaining bid
            5- If no bids are found, increase search range from 14 to 31 days and repeat steps 2-4
      */

      const lastBidsForPeriod = addDays(new Date(), -14);
      const pricesByProvider = Map.groupBy(x.prices, b => b.provider);

      const providersWithBestBid: ProviderWithBestBid[] = [];
      x.providers.forEach(p => {
        const providerBids = pricesByProvider.get(p.owner) ?? [];
        const providerBidsLast14d = providerBids.filter(b => b.datetime > lastBidsForPeriod);
        const bidsFromPricingBot = providerBids.filter(b => b.deployment.owner === pricingBotAddress);

        const bestBid =
          bidsFromPricingBot.length > 0
            ? bidsFromPricingBot.reduce((best, bid) => (bid.height > best.height ? bid : best))
            : this.findBestProviderBid(providerBidsLast14d, x) ?? this.findBestProviderBid(providerBids, x);

        if (bestBid) {
          providersWithBestBid.push({
            provider: p,
            bestBid: bestBid
          });
        }
      });

      models.push({
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
        priceUakt: this.getPricingUakt(providersWithBestBid),
        bidCount: debug ? x.prices.length : undefined,
        providersWithBestBid: debug ? providersWithBestBid : undefined
      });
    });

    return {
      availability: {
        total: totalAllocatable,
        available: totalAllocatable - totalAllocated
      },
      models
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
        currency: "USD" as const,
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: round(average(prices), 2),
        weightedAverage: round(weightedAverage(providersWithBestBid.map(p => ({ value: p.bestBid.hourlyPrice, weight: p.provider.allocatable }))), 2),
        med: round(median(prices), 2)
      };
    } catch (e) {
      this.logger.error({ event: "GPU_PRICING_CALCULATION_FAILED", error: e });
      return null;
    }
  }

  private getPricingUakt(
    providersWithBestBid: {
      provider: GpuProviderType;
      bestBid: GpuBidType;
    }[]
  ) {
    try {
      const bidsWithUaktPrice = providersWithBestBid.filter(x => x.bestBid.hourlyPriceUakt !== null) as {
        provider: GpuProviderType;
        bestBid: GpuBidType & { hourlyPriceUakt: number };
      }[];

      if (!bidsWithUaktPrice || bidsWithUaktPrice.length === 0) return null;

      const prices = bidsWithUaktPrice.map(x => x.bestBid.hourlyPriceUakt);

      return {
        currency: "uakt" as const,
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: round(average(prices), 2),
        weightedAverage: round(weightedAverage(bidsWithUaktPrice.map(p => ({ value: p.bestBid.hourlyPriceUakt, weight: p.provider.allocatable }))), 2),
        med: round(median(prices), 2)
      };
    } catch (e) {
      this.logger.error({ event: "GPU_UAKT_PRICING_CALCULATION_FAILED", error: e });
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
}
