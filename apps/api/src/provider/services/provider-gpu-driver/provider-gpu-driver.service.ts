import { subDays } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository, type RecentNvidiaDriver } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { getMaxCudaVersion } from "@src/gpu/lib/cuda-version/cuda-version";

export type ProviderGpuDriver = RecentNvidiaDriver & { cudaVersion: string | null };

const DRIVER_LOOKBACK_DAYS = 30;

const MAX_LISTED_DRIVERS = 5;

const MIN_REPORTING_OWNERS = 2;

@singleton()
export class ProviderGpuDriverService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProviderGpuDriverService.name });
  }

  async findRecentDrivers(provider: string): Promise<ProviderGpuDriver[]> {
    const drivers = await this.#findRecentNvidiaDrivers(provider);

    return drivers.map(driver => ({ ...driver, cudaVersion: getMaxCudaVersion(driver.driverVersion) }));
  }

  /** An empty list when the readings cannot be loaded, since they only decorate the provider page. */
  async #findRecentNvidiaDrivers(provider: string): Promise<RecentNvidiaDriver[]> {
    try {
      return await this.deploymentSettingRepository.findRecentNvidiaDrivers({
        provider,
        since: subDays(new Date(), DRIVER_LOOKBACK_DAYS),
        limit: MAX_LISTED_DRIVERS,
        minOwners: MIN_REPORTING_OWNERS
      });
    } catch (error) {
      this.#logger.warn({ event: "PROVIDER_GPU_DRIVERS_READ_FAILED", provider, error });
      return [];
    }
  }
}
