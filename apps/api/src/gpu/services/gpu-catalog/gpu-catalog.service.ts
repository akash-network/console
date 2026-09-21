import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { buildGpuCatalogIndex, type GpuCatalogIndex } from "@src/gpu/lib/gpu-model-resolver/gpu-model-resolver";
import { GpuService } from "@src/gpu/services/gpu.service";

@singleton()
export class GpuCatalogService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuService: GpuService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: GpuCatalogService.name });
  }

  /** A catalog the console cannot reach resolves nothing rather than failing the read it decorates. */
  async getIndex(): Promise<GpuCatalogIndex | null> {
    try {
      return buildGpuCatalogIndex(await this.gpuService.getGpuModelCatalog());
    } catch (error) {
      this.logger.error({ event: "GPU_CATALOG_UNAVAILABLE", error });
      return null;
    }
  }
}
