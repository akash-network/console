import { singleton } from "tsyringe";

import type { GpuMarketPricesResponse, GpuMarketQuery, GpuSupplyResponse } from "@src/gpu/http-schemas/gpu-market.schema";
import { GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import { GpuSupplyService } from "@src/gpu/services/gpu-supply/gpu-supply.service";

@singleton()
export class GpuMarketController {
  constructor(
    private readonly gpuMarketPriceRepository: GpuMarketPriceRepository,
    private readonly gpuSupplyService: GpuSupplyService
  ) {}

  async listMarketPrices(query: GpuMarketQuery): Promise<GpuMarketPricesResponse> {
    const rows = await this.gpuMarketPriceRepository.findAllOrdered(query);

    return {
      data: rows.map(({ id: _id, newestSampleAt, computedAt, ...row }) => ({
        ...row,
        newestSampleAt: newestSampleAt.toISOString(),
        computedAt: computedAt.toISOString()
      }))
    };
  }

  async listSupply(query: GpuMarketQuery): Promise<GpuSupplyResponse> {
    return { data: await this.gpuSupplyService.listSupply(query) };
  }
}
