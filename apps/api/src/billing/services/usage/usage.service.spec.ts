import { faker } from "@faker-js/faker";
import { addDays, format } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import type { BillingUsageRawResult, UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";
import { UsageService } from "./usage.service";

import { createAkashAddress } from "@test/seeders";
import { createBillingUsage } from "@test/seeders/billing-usage.seeder";

describe(UsageService.name, () => {
  describe("getHistory", () => {
    it("should return usage history data from repository", async () => {
      const { address, startDate, endDate, data, service, usageRepository } = setup();
      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual(data);
    });

    it("should handle empty history data", async () => {
      const { address, startDate, endDate, service, usageRepository } = setup({
        usageData: []
      });
      usageRepository.getHistory.mockResolvedValue([]);

      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual([]);
    });
  });

  describe("getHistoryStats", () => {
    describe("when history data is available", () => {
      it("should calculate statistics from usage history", async () => {
        const { address, startDate, endDate, service, usageRepository, deploymentRepository, totalDeployments } = setup({
          totalDeployments: 25
        });
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(deploymentRepository.countActiveByOwner).toHaveBeenCalledWith(address, { startDate, endDate });

        expect(result).toEqual({
          totalSpent: 15.55,
          averageSpentPerDay: 5.18,
          totalDeployments,
          averageDeploymentsPerDay: 8.33,
          gpuHours: 0,
          gpuModels: []
        });
      });

      it("should handle single day of data", async () => {
        const { data, address, startDate, endDate, service, usageRepository, totalDeployments } = setup({
          totalDeployments: 25
        });
        const singleDayData = [data[0]];
        usageRepository.getHistory.mockResolvedValue(singleDayData);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 7.75,
          averageSpentPerDay: 7.75,
          totalDeployments,
          averageDeploymentsPerDay: 25.0,
          gpuHours: 0,
          gpuModels: []
        });
      });

      it("should handle zero total leases", async () => {
        const { address, startDate, endDate, service, deploymentRepository } = setup();
        deploymentRepository.countActiveByOwner.mockResolvedValue(0);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 15.55,
          averageSpentPerDay: 5.18,
          totalDeployments: 0,
          averageDeploymentsPerDay: 0.0,
          gpuHours: 0,
          gpuModels: []
        });
      });
    });

    describe("when history data is empty", () => {
      it("should return zero values for all statistics", async () => {
        const { address, startDate, endDate, service, usageRepository, deploymentRepository } = setup({
          usageData: [],
          totalDeployments: 0
        });
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(deploymentRepository.countActiveByOwner).toHaveBeenCalledWith(address, { startDate, endDate });

        expect(result).toEqual({
          totalSpent: 0,
          averageSpentPerDay: 0,
          totalDeployments: 0,
          averageDeploymentsPerDay: 0,
          gpuHours: 0,
          gpuModels: []
        });
      });
    });

    describe("when history data exists but no leases", () => {
      it("should return stats with zero spending but calculate averages correctly", async () => {
        const { address, startDate, endDate, service } = setup({
          totalDeployments: 0
        });
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 15.55,
          averageSpentPerDay: 5.18,
          totalDeployments: 0,
          averageDeploymentsPerDay: 0,
          gpuHours: 0,
          gpuModels: []
        });
      });
    });

    describe("when leases used gpus", () => {
      it("sums every deployment's gpu hours to hundredths and lists each model's display name once", async () => {
        const { address, startDate, endDate, service, deploymentSpendRepository } = setup();
        deploymentSpendRepository.findGpuUsage.mockResolvedValue([
          { dseq: "1", gpuHours: 2.004, gpuModels: ["h100"] },
          { dseq: "2", gpuHours: 4, gpuModels: ["H100", "a100"] }
        ]);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toMatchObject({ gpuHours: 6, gpuModels: ["A100", "H100"] });
      });

      it("reads the gpu usage of every address the wallet spent from over the range", async () => {
        const earlierAddress = createAkashAddress();
        const { address, startDate, endDate, service, usageRepository, deploymentSpendRepository } = setup();
        usageRepository.resolveAddresses.mockResolvedValue([address, earlierAddress]);

        await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.resolveAddresses).toHaveBeenCalledWith(address);
        expect(deploymentSpendRepository.findGpuUsage).toHaveBeenCalledWith({ owners: [address, earlierAddress], startDate, endDate });
      });

      it("reports the gpu usage when the history has no day", async () => {
        const { address, startDate, endDate, service, deploymentSpendRepository } = setup({ usageData: [] });
        deploymentSpendRepository.findGpuUsage.mockResolvedValue([{ dseq: "1", gpuHours: 1.5, gpuModels: ["t4"] }]);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toMatchObject({ gpuHours: 1.5, gpuModels: ["T4"] });
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle repository errors gracefully", async () => {
        const { address, startDate, endDate, service, usageRepository } = setup();

        usageRepository.getHistory.mockRejectedValue(new Error("Database error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Database error");
      });

      it("should handle lease repository errors gracefully", async () => {
        const { address, startDate, endDate, service, usageRepository, deploymentRepository } = setup();

        const mockUsageData = [
          createBillingUsage({
            date: "2024-01-01",
            activeDeployments: 1,
            dailyAktSpent: 5.5,
            totalAktSpent: 5.5,
            dailyUsdcSpent: 2.25,
            totalUsdcSpent: 2.25,
            dailyUsdSpent: 7.75,
            totalUsdSpent: 7.75
          })
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        deploymentRepository.countActiveByOwner.mockRejectedValue(new Error("Lease DB error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Lease DB error");
      });

      it("should handle large numbers and rounding correctly", async () => {
        const { address, startDate, endDate, service, usageRepository, deploymentRepository } = setup();

        const mockUsageData = [
          createBillingUsage({
            date: "2024-01-01",
            activeDeployments: 1,
            dailyAktSpent: 100.123456789,
            totalAktSpent: 100.123456789,
            dailyUsdcSpent: 50.987654321,
            totalUsdcSpent: 50.987654321,
            dailyUsdSpent: 151.11111111,
            totalUsdSpent: 151.11111111
          }),
          createBillingUsage({
            date: "2024-01-02",
            activeDeployments: 1,
            dailyAktSpent: 200.987654321,
            totalAktSpent: 301.11111111,
            dailyUsdcSpent: 75.123456789,
            totalUsdcSpent: 126.11111111,
            dailyUsdSpent: 276.11111111,
            totalUsdSpent: 427.222222221
          })
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        deploymentRepository.countActiveByOwner.mockResolvedValue(1000);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result.totalSpent).toBe(427.22);
        expect(result.averageSpentPerDay).toBe(213.61);
        expect(result.totalDeployments).toBe(1000);
        expect(result.averageDeploymentsPerDay).toBe(500.0);
      });
    });
  });

  function setup(input?: { usageData?: BillingUsageRawResult[]; totalDeployments?: number }) {
    const address = createAkashAddress();
    const startDate = faker.date.past();
    const totalDeployments = input?.totalDeployments ?? faker.number.int({ min: 1, max: 20 });

    const mockUsageData = input?.usageData || [
      createBillingUsage({
        date: format(startDate, "yyyy-MM-dd"),
        activeDeployments: 1,
        dailyAktSpent: 5.5,
        totalAktSpent: 5.5,
        dailyUsdcSpent: 2.25,
        totalUsdcSpent: 2.25,
        dailyUsdSpent: 7.75,
        totalUsdSpent: 7.75
      }),
      createBillingUsage({
        date: format(addDays(startDate, 1), "yyyy-MM-dd"),
        activeDeployments: 2,
        dailyAktSpent: 3.2,
        totalAktSpent: 8.7,
        dailyUsdcSpent: 1.5,
        totalUsdcSpent: 3.75,
        dailyUsdSpent: 4.7,
        totalUsdSpent: 12.45
      }),
      createBillingUsage({
        date: format(addDays(startDate, 2), "yyyy-MM-dd"),
        activeDeployments: 1,
        dailyAktSpent: 2.1,
        totalAktSpent: 10.8,
        dailyUsdcSpent: 1.0,
        totalUsdcSpent: 4.75,
        dailyUsdSpent: 3.1,
        totalUsdSpent: 15.55
      })
    ];

    const usageRepository = mock<UsageRepository>({
      getHistory: vi.fn().mockResolvedValue(mockUsageData),
      resolveAddresses: vi.fn().mockResolvedValue([address])
    });

    const deploymentRepository = mock<DeploymentRepository>({
      countActiveByOwner: vi.fn().mockResolvedValue(totalDeployments)
    });

    const deploymentSpendRepository = mock<DeploymentSpendRepository>({
      findGpuUsage: vi.fn().mockResolvedValue([])
    });

    const service = new UsageService(usageRepository, deploymentRepository, deploymentSpendRepository, new GpuFormattingService());

    return {
      address,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(addDays(startDate, 30), "yyyy-MM-dd"),
      data: mockUsageData,
      service,
      usageRepository,
      deploymentRepository,
      deploymentSpendRepository,
      totalDeployments
    };
  }
});
