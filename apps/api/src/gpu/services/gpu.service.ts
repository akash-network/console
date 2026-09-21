import type { HttpClient } from "@akashnetwork/http-sdk";
import { minutesToSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { Memoize, memoizeAsync } from "@src/caching/helpers";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import { type GpuBreakdownQuery } from "../http-schemas/gpu.schema";
import { GPU_MODELS_HTTP_CLIENT } from "../providers/gpu-models-client.provider";
import { GpuRepository } from "../repositories/gpu.repository";
import { GpuFormattingService } from "./gpu-formatting/gpu-formatting.service";

@singleton()
export class GpuService {
  constructor(
    private readonly gpuRepository: GpuRepository,
    private readonly gpuFormattingService: GpuFormattingService,
    @inject(GPU_MODELS_HTTP_CLIENT) private readonly httpClient: HttpClient
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
  } = {}) {
    const gpuNodes = await this.gpuRepository.getGpuList({
      providerAddress,
      providerHostUri,
      vendor,
      model,
      memorySize
    });

    const response = {
      gpus: {
        total: {
          allocatable: gpuNodes.map(x => x.allocatable).reduce((acc, x) => acc + x, 0),
          allocated: gpuNodes.map(x => x.allocated).reduce((acc, x) => acc + x, 0)
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
        x => x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
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

    for (const vendorName in response.gpus.details) {
      response.gpus.details[vendorName] = response.gpus.details[vendorName].sort(
        (a, b) => a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
      );
    }

    return response;
  }

  /** The catalog as published, keyed by the pci ids `mapProviderConfig` drops, which is what identifies a card the driver reports. */
  @Memoize({ ttlInSeconds: minutesToSeconds(2) })
  async getGpuModelCatalog(): Promise<ProviderConfigGpusType> {
    const response = await this.httpClient.get<ProviderConfigGpusType>("/gpus.json");
    return response.data;
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(2) })
  async getGpuModels() {
    return this.gpuFormattingService.mapProviderConfig(await this.getGpuModelCatalog());
  }

  readonly getGpuBreakdown = memoizeAsync((query: GpuBreakdownQuery) => this.gpuRepository.getGpuBreakdown(query), {
    cacheItemLimit: 500,
    ttl: minutesToSeconds(5) * 1000,
    getCacheKey: query => JSON.stringify([query.vendor, query.model, query.startDate, query.endDate]),
    name: "GpuService#getGpuBreakdown"
  });
}
