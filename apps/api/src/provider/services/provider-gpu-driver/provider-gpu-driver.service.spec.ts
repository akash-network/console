import { subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { LeaseGpuReading } from "@src/deployment/model-schemas";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ProviderGpuDriverService } from "./provider-gpu-driver.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createLeaseGpuReading } from "@test/seeders/lease-gpu-reading.seeder";

describe(ProviderGpuDriverService.name, () => {
  describe("findRecentDrivers", () => {
    it("lists each driver version once with the cuda version it supports and the day it was last read", async () => {
      const provider = createAkashAddress();
      const { service } = setup({
        readings: [
          createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt: daysAgo(5) }),
          createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt: daysAgo(2) })
        ]
      });

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers).toEqual([{ driverVersion: "550.54.15", cudaVersion: "12.4", lastSeenDate: dayOf(daysAgo(2)) }]);
    });

    it("lists the most recently read driver first", async () => {
      const provider = createAkashAddress();
      const { service } = setup({
        readings: [
          createLeaseGpuReading({ provider, driverVersion: "535.183.01", detectedAt: daysAgo(1) }),
          createLeaseGpuReading({ provider, driverVersion: "570.86.15", detectedAt: daysAgo(10) })
        ]
      });

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers.map(driver => driver.driverVersion)).toEqual(["535.183.01", "570.86.15"]);
    });

    it("leaves out a driver read only before the last 30 days", async () => {
      const provider = createAkashAddress();
      const { service } = setup({
        readings: [
          createLeaseGpuReading({ provider, driverVersion: "535.54.03", detectedAt: daysAgo(31) }),
          createLeaseGpuReading({ provider, driverVersion: "550.54.15", detectedAt: daysAgo(29) })
        ]
      });

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers.map(driver => driver.driverVersion)).toEqual(["550.54.15"]);
    });

    it("leaves out readings that carry no nvidia driver", async () => {
      const provider = createAkashAddress();
      const { service } = setup({
        readings: [
          createLeaseGpuReading({ provider, source: "rocm-smi", driverVersion: null, detectedAt: daysAgo(1) }),
          createLeaseGpuReading({ provider, source: "none", driverVersion: null, gpus: [], detectedAt: daysAgo(1) }),
          createLeaseGpuReading({ provider, source: "nvidia-smi", driverVersion: null, detectedAt: daysAgo(1) })
        ]
      });

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers).toEqual([]);
    });

    it("keeps a driver whose cuda version is unknown", async () => {
      const provider = createAkashAddress();
      const { service } = setup({ readings: [createLeaseGpuReading({ provider, driverVersion: "440.33.01", detectedAt: daysAgo(1) })] });

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers).toEqual([{ driverVersion: "440.33.01", cudaVersion: null, lastSeenDate: dayOf(daysAgo(1)) }]);
    });

    it("answers no drivers and logs when the readings cannot be loaded", async () => {
      const provider = createAkashAddress();
      const error = new Error("connection refused");
      const { service, deploymentSettingRepository, logger } = setup({ readings: [] });
      deploymentSettingRepository.findGpuReadingsByProvider.mockRejectedValue(error);

      const drivers = await service.findRecentDrivers(provider);

      expect(drivers).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith({ event: "PROVIDER_GPU_DRIVERS_READ_FAILED", provider, error });
    });
  });

  function daysAgo(days: number) {
    return subDays(new Date(), days).toISOString();
  }

  function dayOf(isoDate: string) {
    return isoDate.slice(0, 10);
  }

  function setup(input: { readings: LeaseGpuReading[] }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findGpuReadingsByProvider.mockResolvedValue(input.readings);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ProviderGpuDriverService(deploymentSettingRepository, createLogger);

    return { service, deploymentSettingRepository, logger };
  }
});
