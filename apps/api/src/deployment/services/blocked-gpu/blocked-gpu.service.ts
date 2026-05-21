import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RequestedGpu } from "@src/deployment/utils/blocked-gpu/blocked-gpu";
import {
  extractRequestedGpusFromBid,
  extractRequestedGpusFromGroupSpecs,
  extractRequestedGpusFromSdl,
  findBlockedGpus,
  formatGpuLabel,
  toBlockedGpuSet
} from "@src/deployment/utils/blocked-gpu/blocked-gpu";

export type { RequestedGpu };

@singleton()
export class BlockedGpuService {
  constructor(private readonly billingConfig: BillingConfigService) {}

  findInSdl(sdl: SDLInput | null | undefined): RequestedGpu[] {
    return this.match(extractRequestedGpusFromSdl(sdl));
  }

  findInGroupSpecs(groups: GroupSpec[] | null | undefined): RequestedGpu[] {
    return this.match(extractRequestedGpusFromGroupSpecs(groups));
  }

  findInBid(bid: Bid): RequestedGpu[] {
    return this.match(extractRequestedGpusFromBid(bid));
  }

  formatList(gpus: RequestedGpu[]): string {
    return gpus.map(formatGpuLabel).join(", ");
  }

  hasBlockedModels(): boolean {
    return this.billingConfig.get("MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS").length > 0;
  }

  private match(requested: RequestedGpu[]): RequestedGpu[] {
    const blocked = this.billingConfig.get("MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS");
    if (!blocked.length) return [];
    return findBlockedGpus(requested, toBlockedGpuSet(blocked));
  }
}
