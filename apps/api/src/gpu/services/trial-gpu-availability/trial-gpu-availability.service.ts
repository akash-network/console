import { minutesToMilliseconds } from "date-fns";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { memoizeAsync } from "@src/caching/helpers";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import type { TrialGpuAvailability } from "@src/gpu/http-schemas/gpu.schema";
import { GpuRepository } from "@src/gpu/repositories/gpu.repository";

type GpuNode = Awaited<ReturnType<GpuRepository["getGpuList"]>>[number];

@singleton()
export class TrialGpuAvailabilityService {
  constructor(
    private readonly gpuRepository: GpuRepository,
    private readonly billingConfig: BillingConfigService,
    private readonly blockedGpuService: BlockedGpuService
  ) {}

  readonly getFreeTrialGpus = memoizeAsync(() => this.#countFreeTrialGpus(), {
    cacheItemLimit: 1,
    ttl: minutesToMilliseconds(1),
    name: "TrialGpuAvailabilityService#getFreeTrialGpus"
  });

  async #countFreeTrialGpus(): Promise<TrialGpuAvailability[]> {
    const gpuNodes = await this.gpuRepository.getGpuList({ signedByAnyOf: this.billingConfig.get("MANAGED_WALLET_LEASE_ALLOWED_AUDITORS") });
    const freeUnitsByGpu = new Map<string, TrialGpuAvailability>();

    for (const gpuNode of gpuNodes) {
      const gpu = this.#toTrialAllowedGpu(gpuNode);
      if (!gpu) continue;

      const key = `${gpu.vendor}/${gpu.model}`;
      const freeUnits = Math.max(gpuNode.allocatable - gpuNode.allocated, 0);
      const existing = freeUnitsByGpu.get(key);

      if (existing) {
        existing.freeUnits += freeUnits;
      } else {
        freeUnitsByGpu.set(key, { ...gpu, freeUnits });
      }
    }

    return Array.from(freeUnitsByGpu.values())
      .filter(gpu => gpu.freeUnits > 0)
      .sort((a, b) => b.freeUnits - a.freeUnits || a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
  }

  #toTrialAllowedGpu(gpuNode: GpuNode) {
    if (!gpuNode.vendor || !gpuNode.modelName) return null;

    const gpu = { vendor: gpuNode.vendor.toLowerCase(), model: gpuNode.modelName.toLowerCase() };

    return this.blockedGpuService.isBlocked(gpu) ? null : gpu;
  }
}
