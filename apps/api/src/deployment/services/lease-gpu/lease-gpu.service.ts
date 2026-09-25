import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { LeaseGpuReading } from "@src/deployment/model-schemas";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
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

function groupByLease(readings: LeaseGpuReading[]): Map<string, LeaseGpuReading[]> {
  const byLease = new Map<string, LeaseGpuReading[]>();

  for (const reading of readings) {
    byLease.set(leaseGpuKeyOf(reading), [...(byLease.get(leaseGpuKeyOf(reading)) ?? []), reading]);
  }

  return byLease;
}

/** Turns the raw readings a probe stored into what a deployment read serves, resolving the model catalog once per request. */
@singleton()
export class LeaseGpuService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly gpuCatalogService: GpuCatalogService,
    private readonly gpuFormattingService: GpuFormattingService,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LeaseGpuService.name });
  }

  /** A reading the console cannot load leaves the field off rather than failing the deployment read it decorates. */
  async findForDeployments(input: { userId: string; dseqs: string[] }): Promise<Map<string, DetectedGpusByLease>> {
    try {
      return await this.#findForDeployments(input);
    } catch (error) {
      this.logger.warn({ event: "LEASE_GPU_READ_FAILED", userId: input.userId, dseqs: input.dseqs, error });
      return new Map();
    }
  }

  async #findForDeployments({ userId, dseqs }: { userId: string; dseqs: string[] }): Promise<Map<string, DetectedGpusByLease>> {
    if (!dseqs.length) return new Map();

    const readingsByDeployment = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findGpuReadings({ userId, dseqs });
    if (!readingsByDeployment.size) return new Map();

    const index = await this.gpuCatalogService.getIndex();
    const byDeployment = new Map<string, DetectedGpusByLease>();

    for (const [dseq, readings] of readingsByDeployment) {
      byDeployment.set(dseq, new Map([...groupByLease(readings)].map(([key, leaseReadings]) => [key, this.#summarize(leaseReadings, index)])));
    }

    return byDeployment;
  }

  /** Reports when the lease was last read, since its services are read one at a time and stored in no particular order. */
  #summarize(leaseReadings: LeaseGpuReading[], index: Awaited<ReturnType<GpuCatalogService["getIndex"]>>): DetectedLeaseGpus {
    const newestFirst = [...leaseReadings].sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    const byService = [...leaseReadings].sort((a, b) => a.service.localeCompare(b.service));

    return {
      services: byService.map(reading => ({ service: reading.service, gpus: this.#resolve(reading, index) })),
      driverVersion: newestFirst.find(reading => reading.driverVersion)?.driverVersion ?? null,
      detectedAt: newestFirst[0].detectedAt
    };
  }

  #resolve(reading: LeaseGpuReading, index: Awaited<ReturnType<GpuCatalogService["getIndex"]>>): DetectedGpu[] {
    return reading.gpus.map(gpu => {
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
