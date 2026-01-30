import { singleton } from "tsyringe";

import { GpuBreakdownQuery } from "@src/gpu/http-schemas/gpu.schema";
import { GpuService } from "@src/gpu/services/gpu.service";
import { GpuPriceService } from "@src/gpu/services/gpu-price/gpu-price.service";

@singleton()
export class GpuController {
  constructor(
    private readonly gpuService: GpuService,
    private readonly gpuPriceService: GpuPriceService
  ) {}
  async getGpuList({
    providerAddress,
    providerHostUri,
    vendor,
    model,
    memorySize
  }: {
    providerAddress?: string;
    providerHostUri?: string;
    vendor?: string;
    model?: string;
    memorySize?: string;
  }) {
    return await this.gpuService.getGpuList({ vendor, model, memorySize, providerAddress, providerHostUri });
  }

  async getGpuModels() {
    return await this.gpuService.getGpuModels();
  }

  async getGpuBreakdown(query: GpuBreakdownQuery) {
    return await this.gpuService.getGpuBreakdown(query);
  }

  async getGpuPrices(debug: boolean) {
    return await this.gpuPriceService.getGpuPrices(debug);
  }
}
