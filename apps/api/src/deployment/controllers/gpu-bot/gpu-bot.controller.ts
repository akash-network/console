import { singleton } from "tsyringe";

import { GpuBidsCreatorService } from "@src/deployment/services/gpu-bids-creator/gpu-bids-creator.service";

@singleton()
export class GpuBotController {
  constructor(private readonly gpuBidsCreatorService: GpuBidsCreatorService) {}

  async createGpuBids() {
    await this.gpuBidsCreatorService.createGpuBids();
  }
}
