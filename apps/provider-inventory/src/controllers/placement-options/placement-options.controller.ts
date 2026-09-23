import { singleton } from "tsyringe";

import type { PlacementOptionsResponse } from "@src/http-schemas/placement-options.schema";
import { mapToGpuVendorOptions } from "@src/mappers/gpu-options-mapper/gpu-options-mapper";
import { PlacementOptionsRepository } from "@src/repositories/placement-options/placement-options.repository";

@singleton()
export class PlacementOptionsController {
  readonly #placementOptionsRepository: PlacementOptionsRepository;

  constructor(placementOptionsRepository: PlacementOptionsRepository) {
    this.#placementOptionsRepository = placementOptionsRepository;
  }

  async getPlacementOptions(): Promise<PlacementOptionsResponse> {
    const [onlineRegions, gpus] = await Promise.all([
      this.#placementOptionsRepository.findOnlineRegions(),
      this.#placementOptionsRepository.findAvailableGpus()
    ]);

    return {
      regions: onlineRegions.map(({ region }) => region),
      regionProviderCounts: Object.fromEntries(onlineRegions.map(({ region, providerCount }) => [region, providerCount])),
      gpus: mapToGpuVendorOptions(gpus)
    };
  }
}
