import { inject, singleton } from "tsyringe";

import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";

@singleton()
export class GpuWaitlistNetworkService {
  constructor(
    private readonly coreConfigService: CoreConfigService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig
  ) {}

  servesGpuWaitlists(): boolean {
    return this.config.GPU_WAITLIST_NETWORKS.includes(this.coreConfigService.get("NETWORK"));
  }
}
