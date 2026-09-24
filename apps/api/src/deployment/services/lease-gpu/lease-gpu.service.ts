import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type OfferedGpuModel, readOfferedGpus } from "@src/deployment/lib/lease-gpu-offers/lease-gpu-offers";
import type { LeaseGpuOffer, LeaseGpuReading } from "@src/deployment/model-schemas";
import { DeploymentSettingRepository, type StoredLeaseGpus } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
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

export type OfferedGpu = OfferedGpuModel & { displayName: string };

export type OfferedLeaseGpus = {
  gpus: OfferedGpu[];
  recordedAt: string;
};

export type LeaseGpus = {
  detectedGpus?: DetectedLeaseGpus;
  offeredGpus?: OfferedLeaseGpus;
};

/** Keyed the only way the chain's lease and the console's row both identify one placement: an order is leased at most once, so its bid sequence adds nothing here. */
export type LeaseGpusByLease = Map<string, LeaseGpus>;

type CatalogIndex = Awaited<ReturnType<GpuCatalogService["getIndex"]>>;

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

/** Turns the raw readings and offers the console stored into what a deployment read serves, resolving the model catalog once per request. */
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
  async findForDeployments(input: { userId: string; dseqs: string[] }): Promise<Map<string, LeaseGpusByLease>> {
    try {
      return await this.#findForDeployments(input);
    } catch (error) {
      this.logger.warn({ event: "LEASE_GPU_READ_FAILED", userId: input.userId, dseqs: input.dseqs, error });
      return new Map();
    }
  }

  async #findForDeployments({ userId, dseqs }: { userId: string; dseqs: string[] }): Promise<Map<string, LeaseGpusByLease>> {
    if (!dseqs.length) return new Map();

    const storedByDeployment = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findLeaseGpus({ userId, dseqs });
    const index = [...storedByDeployment.values()].some(stored => stored.readings.length) ? await this.gpuCatalogService.getIndex() : null;

    return new Map([...storedByDeployment].map(([dseq, stored]) => [dseq, this.#byLease(stored, index)]));
  }

  #byLease({ readings, offers }: StoredLeaseGpus, index: CatalogIndex): LeaseGpusByLease {
    const byLease: LeaseGpusByLease = new Map();

    for (const [key, leaseReadings] of groupByLease(readings)) {
      byLease.set(key, { detectedGpus: this.#summarize(leaseReadings, index) });
    }

    for (const offer of offers) {
      const key = leaseGpuKeyOf(offer);
      byLease.set(key, { ...byLease.get(key), offeredGpus: this.#describeOffer(offer) });
    }

    return byLease;
  }

  #describeOffer(offer: LeaseGpuOffer): OfferedLeaseGpus {
    return {
      gpus: readOfferedGpus(offer).map(gpu => ({ ...gpu, displayName: this.gpuFormattingService.formatModelName(gpu.model) })),
      recordedAt: offer.recordedAt
    };
  }

  /** Reports when the lease was last read, since its services are read one at a time and stored in no particular order. */
  #summarize(leaseReadings: LeaseGpuReading[], index: CatalogIndex): DetectedLeaseGpus {
    const newestFirst = [...leaseReadings].sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    const byService = [...leaseReadings].sort((a, b) => a.service.localeCompare(b.service));

    return {
      services: byService.map(reading => ({ service: reading.service, gpus: this.#resolve(reading, index) })),
      driverVersion: newestFirst.find(reading => reading.driverVersion)?.driverVersion ?? null,
      detectedAt: newestFirst[0].detectedAt
    };
  }

  #resolve(reading: LeaseGpuReading, index: CatalogIndex): DetectedGpu[] {
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
