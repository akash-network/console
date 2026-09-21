import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type LeaseGpuOutput, LeaseGpuRepository } from "@src/deployment/repositories/lease-gpu/lease-gpu.repository";
import { resolveGpuModel } from "@src/gpu/lib/gpu-model-resolver/gpu-model-resolver";
import { GpuCatalogService } from "@src/gpu/services/gpu-catalog/gpu-catalog.service";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";

export type DetectedGpu = {
  vendor: string | null;
  model: string | null;
  displayName: string;
  memoryMb: number;
  interface: string | null;
  count: number;
};

export type DetectedLeaseGpus = {
  services: Array<{ service: string; gpus: DetectedGpu[] }>;
  driverVersion: string | null;
  detectedAt: string;
};

/** Keyed the only way the chain's lease and the console's row both identify one placement. */
export type DetectedGpusByLease = Map<string, DetectedLeaseGpus>;

/** A driver string long enough to wreck a layout is not one a card really has, so it is shown trimmed. */
const MAX_DISPLAY_NAME_LENGTH = 48;

export function leaseGpuKeyOf(lease: { gseq: number; oseq: number; provider: string }): string {
  return `${lease.gseq}/${lease.oseq}/${lease.provider}`;
}

/** Turns the raw readings a probe stored into what a deployment read serves, resolving the model catalog once per request. */
@singleton()
export class LeaseGpuService {
  constructor(
    private readonly leaseGpuRepository: LeaseGpuRepository,
    private readonly gpuCatalogService: GpuCatalogService,
    private readonly gpuFormattingService: GpuFormattingService,
    private readonly authService: AuthService
  ) {}

  async findForDeployments({ userId, dseqs }: { userId: string; dseqs: string[] }): Promise<Map<string, DetectedGpusByLease>> {
    if (!dseqs.length) return new Map();

    const rows = await this.leaseGpuRepository.accessibleBy(this.authService.ability, "read").findForDeployments({ userId, dseqs });
    if (!rows.length) return new Map();

    const index = await this.gpuCatalogService.getIndex();
    const byDeployment = new Map<string, DetectedGpusByLease>();

    for (const row of rows) {
      const byLease = byDeployment.get(row.dseq) ?? new Map<string, DetectedLeaseGpus>();
      byDeployment.set(row.dseq, byLease);

      const key = leaseGpuKeyOf(row);
      const detected = byLease.get(key) ?? { services: [], driverVersion: row.driverVersion, detectedAt: row.detectedAt.toISOString() };
      detected.services.push({ service: row.service, gpus: this.#resolve(row, index) });
      detected.driverVersion ??= row.driverVersion;
      byLease.set(key, detected);
    }

    return byDeployment;
  }

  #resolve(row: LeaseGpuOutput, index: Awaited<ReturnType<GpuCatalogService["getIndex"]>>): DetectedGpu[] {
    return row.gpus.map(gpu => {
      const resolved = resolveGpuModel(gpu, index);

      return {
        vendor: resolved.vendor,
        model: resolved.model,
        displayName: resolved.model ? this.gpuFormattingService.formatModelName(resolved.model) : gpu.rawName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
        memoryMb: gpu.memoryMb,
        interface: resolved.interface,
        count: gpu.count
      };
    });
  }
}
