import { differenceInDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, RecentNvidiaDriver } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { BUNDLED_CUDA_MINIMUM_DRIVERS, type CudaMinimumDriver } from "@src/gpu/lib/cuda-version/cuda-version";
import type { CudaDriverTableService } from "@src/gpu/services/cuda-driver-table/cuda-driver-table.service";
import { ProviderGpuDriverService } from "./provider-gpu-driver.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(ProviderGpuDriverService.name, () => {
  describe("findRecentDrivers", () => {
    it("lists each recent driver with the cuda version it supports", async () => {
      const { service } = setup({
        drivers: [
          { driverVersion: "550.54.15", lastSeenDate: "2026-09-21" },
          { driverVersion: "440.33.01", lastSeenDate: "2026-09-18" }
        ]
      });

      const drivers = await service.findRecentDrivers(createAkashAddress());

      expect(drivers).toEqual([
        { driverVersion: "550.54.15", cudaVersion: "12.4", lastSeenDate: "2026-09-21" },
        { driverVersion: "440.33.01", cudaVersion: null, lastSeenDate: "2026-09-18" }
      ]);
    });

    it("reads the cuda version off the refreshed table", async () => {
      const { service } = setup({
        drivers: [{ driverVersion: "620.10.01", lastSeenDate: "2026-09-21" }],
        minimumDrivers: [...BUNDLED_CUDA_MINIMUM_DRIVERS, { cudaVersion: "13.5", minimumDriver: [620] }]
      });

      const drivers = await service.findRecentDrivers(createAkashAddress());

      expect(drivers).toEqual([{ driverVersion: "620.10.01", cudaVersion: "13.5", lastSeenDate: "2026-09-21" }]);
    });

    it("leaves the table alone for a provider with no driver to list", async () => {
      const { service, cudaDriverTableService } = setup({ drivers: [] });

      await service.findRecentDrivers(createAkashAddress());

      expect(cudaDriverTableService.getMinimumDrivers).not.toHaveBeenCalled();
    });

    it("asks for at most 5 drivers read on the provider over the last 30 days by at least 2 owners", async () => {
      const provider = createAkashAddress();
      const { service, deploymentSettingRepository } = setup({ drivers: [] });

      await service.findRecentDrivers(provider);

      const [{ since, ...query }] = deploymentSettingRepository.findRecentNvidiaDrivers.mock.calls[0];
      expect(query).toEqual({ provider, limit: 5, minOwners: 2 });
      expect(differenceInDays(new Date(), since)).toBe(30);
    });

    it("answers no drivers and logs when the readings cannot be loaded", async () => {
      const provider = createAkashAddress();
      const error = new Error("connection refused");
      const { service, deploymentSettingRepository, logger } = setup({ drivers: [] });
      deploymentSettingRepository.findRecentNvidiaDrivers.mockRejectedValue(error);

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith({ event: "PROVIDER_GPU_DRIVERS_READ_FAILED", provider, error });
    });
  });

  function setup(input: { drivers: RecentNvidiaDriver[]; minimumDrivers?: CudaMinimumDriver[] }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findRecentNvidiaDrivers.mockResolvedValue(input.drivers);
    const cudaDriverTableService = mock<CudaDriverTableService>();
    cudaDriverTableService.getMinimumDrivers.mockResolvedValue(input.minimumDrivers ?? BUNDLED_CUDA_MINIMUM_DRIVERS);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ProviderGpuDriverService(deploymentSettingRepository, cudaDriverTableService, createLogger);

    return { service, deploymentSettingRepository, cudaDriverTableService, logger };
  }
});
