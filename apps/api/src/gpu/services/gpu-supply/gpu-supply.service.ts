import { singleton } from "tsyringe";

import type { GpuMarketQuery, GpuSupplyResponse } from "@src/gpu/http-schemas/gpu-market.schema";
import { toRegionArea } from "@src/gpu/lib/region-area/region-area";
import { GpuPriceService } from "@src/gpu/services/gpu-price/gpu-price.service";
import type { GpuPriceModel } from "@src/gpu/types/gpu.type";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";

@singleton()
export class GpuSupplyService {
  constructor(
    private readonly gpuPriceService: GpuPriceService,
    private readonly providerRepository: ProviderRepository
  ) {}

  /** Lists online gpu capacity with only the providers that really bid on it, since bid screening lists providers that never bid. */
  async listSupply(query: GpuMarketQuery): Promise<GpuSupplyResponse["data"]> {
    const { models } = await this.gpuPriceService.getGpuPrices(true);
    const matchingModels = models.filter(model => matches(model, query));
    const owners = [...new Set(matchingModels.flatMap(model => (model.providersWithBestBid ?? []).map(({ provider }) => provider.owner)))];
    const regions = await this.providerRepository.findLocationRegions(owners);

    return matchingModels.map(model => ({
      vendor: model.vendor,
      model: model.model,
      ram: model.ram,
      interface: model.interface,
      allocatable: model.availability.total,
      available: model.availability.available,
      providers: (model.providersWithBestBid ?? []).map(({ provider, bestBid }) => ({
        owner: provider.owner,
        hostUri: provider.hostUri,
        region: regions.get(provider.owner) ?? null,
        area: toRegionArea(regions.get(provider.owner)),
        allocatable: provider.allocatable,
        available: provider.allocatable - provider.allocated,
        bestBid: { usdPerGpuHour: bestBid.hourlyPrice, placedAt: new Date(bestBid.datetime).toISOString() }
      }))
    }));
  }
}

function matches(model: GpuPriceModel, { vendor, model: modelName }: GpuMarketQuery): boolean {
  return (!vendor || model.vendor.toLowerCase() === vendor.toLowerCase()) && (!modelName || model.model.toLowerCase() === modelName.toLowerCase());
}
