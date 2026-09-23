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

function groupByDeploymentAndLease(rows: LeaseGpuOutput[]): Map<string, Map<string, LeaseGpuOutput[]>> {
  const grouped = new Map<string, Map<string, LeaseGpuOutput[]>>();

  for (const row of rows) {
    const byLease = grouped.get(row.dseq) ?? new Map<string, LeaseGpuOutput[]>();
    grouped.set(row.dseq, byLease);
    byLease.set(leaseGpuKeyOf(row), [...(byLease.get(leaseGpuKeyOf(row)) ?? []), row]);
  }

  return grouped;
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

    for (const [dseq, rowsByLease] of groupByDeploymentAndLease(rows)) {
      byDeployment.set(dseq, new Map([...rowsByLease].map(([key, leaseRows]) => [key, this.#summarize(leaseRows, index)])));
    }

    return byDeployment;
  }

  /** Reports when the lease was last read, since its services are read one at a time and the rows come back in no particular order. */
  #summarize(leaseRows: LeaseGpuOutput[], index: Awaited<ReturnType<GpuCatalogService["getIndex"]>>): DetectedLeaseGpus {
    const newestFirst = [...leaseRows].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    const byService = [...leaseRows].sort((a, b) => a.service.localeCompare(b.service));

    return {
      services: byService.map(row => ({ service: row.service, gpus: this.#resolve(row, index) })),
      driverVersion: newestFirst.find(row => row.driverVersion)?.driverVersion ?? null,
      detectedAt: newestFirst[0].detectedAt.toISOString()
    };
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
