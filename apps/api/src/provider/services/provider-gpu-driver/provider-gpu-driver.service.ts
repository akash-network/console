import { subDays } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { LeaseGpuReading } from "@src/deployment/model-schemas";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { getMaxCudaVersion } from "@src/gpu/lib/cuda-version/cuda-version";

export type ProviderGpuDriver = { driverVersion: string; cudaVersion: string | null; lastSeenDate: string };

type NvidiaReading = LeaseGpuReading & { driverVersion: string };

const DRIVER_LOOKBACK_DAYS = 30;

@singleton()
export class ProviderGpuDriverService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProviderGpuDriverService.name });
  }

  /** An empty list when the readings cannot be loaded, since they only decorate the provider page. */
  async findRecentDrivers(provider: string): Promise<ProviderGpuDriver[]> {
    const readings = await this.#findReadings(provider);
    const since = subDays(new Date(), DRIVER_LOOKBACK_DAYS);
    const lastSeenByDriver = new Map<string, Date>();

    for (const reading of readings.filter(reading => isNvidiaReadingSince(reading, since))) {
      const detectedAt = new Date(reading.detectedAt);
      const lastSeen = lastSeenByDriver.get(reading.driverVersion);
      if (!lastSeen || detectedAt > lastSeen) lastSeenByDriver.set(reading.driverVersion, detectedAt);
    }

    return [...lastSeenByDriver]
      .sort(([, left], [, right]) => right.getTime() - left.getTime())
      .map(([driverVersion, lastSeen]) => ({
        driverVersion,
        cudaVersion: getMaxCudaVersion(driverVersion),
        lastSeenDate: lastSeen.toISOString().slice(0, 10)
      }));
  }

  async #findReadings(provider: string): Promise<LeaseGpuReading[]> {
    try {
      return await this.deploymentSettingRepository.findGpuReadingsByProvider(provider);
    } catch (error) {
      this.#logger.warn({ event: "PROVIDER_GPU_DRIVERS_READ_FAILED", provider, error });
      return [];
    }
  }
}

function isNvidiaReadingSince(reading: LeaseGpuReading, since: Date): reading is NvidiaReading {
  return reading.source === "nvidia-smi" && !!reading.driverVersion && new Date(reading.detectedAt) >= since;
}
