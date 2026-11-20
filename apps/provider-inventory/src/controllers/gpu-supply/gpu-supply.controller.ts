import { singleton } from "tsyringe";

import type { GpuSupplyRequest, GpuSupplyResponse } from "@src/http-schemas/gpu-supply.schema";
import { PlacementOptionsRepository } from "@src/repositories/placement-options/placement-options.repository";

@singleton()
export class GpuSupplyController {
  readonly #placementOptionsRepository: PlacementOptionsRepository;

  constructor(placementOptionsRepository: PlacementOptionsRepository) {
    this.#placementOptionsRepository = placementOptionsRepository;
  }

  async getGpuSupply({ vendor, model }: GpuSupplyRequest): Promise<GpuSupplyResponse> {
    const gpus = await this.#placementOptionsRepository.findAvailableGpus({ includeUnaudited: false });
    const wantedVendor = vendor.toLowerCase();
    const wantedModel = model.toLowerCase();

    return {
      data: gpus
        .filter(gpu => gpu.vendor.toLowerCase() === wantedVendor && gpu.model.toLowerCase() === wantedModel)
        .map(({ owner, node, vendor, model, memory, interface: gpuInterface, units, nodeFreeUnits }) => ({
          owner,
          node,
          vendor,
          model,
          memory,
          interface: gpuInterface,
          units,
          nodeFreeUnits
        }))
    };
  }
}
