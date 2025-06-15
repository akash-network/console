import { faker } from "@faker-js/faker";
import { addDays, format } from "date-fns";

import type { BillingUsageRawResult, UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { UsageService } from "./usage.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { BillingUsageSeeder } from "@test/seeders/billing-usage.seeder";
import { stub } from "@test/services/stub";

describe(UsageService.name, () => {
  describe("getHistory", () => {
    it("should return usage history data from repository", async () => {
      const { address, startDate, endDate, data, service, usageRepository } = setup();
      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual(data);
    });

    it("should handle empty history data", async () => {
      const { address, startDate, endDate, service, usageRepository } = setup([]);
      usageRepository.getHistory.mockResolvedValue([]);

      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual([]);
    });
  });

  describe("getHistoryStats", () => {
    describe("when history data is available", () => {
      it("should calculate statistics from usage history", async () => {
        const { address, startDate, endDate, service, usageRepository, leaseRepository, leasesCount } = setup(undefined, 25);
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(leaseRepository.countByOwner).toHaveBeenCalledWith(address);

        expect(result).toEqual({
          totalSpent: 15.55,
          averagePerDay: 5.18,
          totalLeases: leasesCount,
          averageLeasesPerDay: 8.33
        });
      });

      it("should handle single day of data", async () => {
        const { data, address, startDate, endDate, service, usageRepository, leasesCount } = setup(undefined, 25);
        const singleDayData = [data[0]];
        usageRepository.getHistory.mockResolvedValue(singleDayData);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 7.75,
          averagePerDay: 7.75,
          totalLeases: leasesCount,
          averageLeasesPerDay: 25.0
        });
      });

      it("should handle zero total leases", async () => {
        const { address, startDate, endDate, service, leaseRepository } = setup();
        leaseRepository.countByOwner.mockResolvedValue(0);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 15.55,
          averagePerDay: 5.18,
          totalLeases: 0,
          averageLeasesPerDay: 0.0
        });
      });
    });

    describe("when history data is empty", () => {
      it("should return zero values for all statistics", async () => {
        const { address, startDate, endDate, service, usageRepository, leaseRepository } = setup([], 0);
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(leaseRepository.countByOwner).toHaveBeenCalledWith(address);

        expect(result).toEqual({
          totalSpent: 0,
          averagePerDay: 0,
          totalLeases: 0,
          averageLeasesPerDay: 0
        });
      });
    });

    describe("when history data exists but no leases", () => {
      it("should return stats with zero spending but calculate averages correctly", async () => {
        const { address, startDate, endDate, service } = setup(undefined, 0);
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 15.55,
          averagePerDay: 5.18,
          totalLeases: 0,
          averageLeasesPerDay: 0
        });
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle repository errors gracefully", async () => {
        const { address, startDate, endDate, service, usageRepository } = setup();

        usageRepository.getHistory.mockRejectedValue(new Error("Database error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Database error");
      });

      it("should handle lease repository errors gracefully", async () => {
        const { address, startDate, endDate, service, usageRepository, leaseRepository } = setup();

        const mockUsageData = [
          BillingUsageSeeder.create({
            date: "2024-01-01",
            activeLeases: 1,
            dailyAktSpent: 5.5,
            totalAktSpent: 5.5,
            dailyUsdcSpent: 2.25,
            totalUsdcSpent: 2.25,
            dailyUsdSpent: 7.75,
            totalUsdSpent: 7.75
          })
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByOwner.mockRejectedValue(new Error("Lease DB error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Lease DB error");
      });

      it("should handle large numbers and rounding correctly", async () => {
        const { address, startDate, endDate, service, usageRepository, leaseRepository } = setup();

        const mockUsageData = [
          BillingUsageSeeder.create({
            date: "2024-01-01",
            activeLeases: 1,
            dailyAktSpent: 100.123456789,
            totalAktSpent: 100.123456789,
            dailyUsdcSpent: 50.987654321,
            totalUsdcSpent: 50.987654321,
            dailyUsdSpent: 151.11111111,
            totalUsdSpent: 151.11111111
          }),
          BillingUsageSeeder.create({
            date: "2024-01-02",
            activeLeases: 1,
            dailyAktSpent: 200.987654321,
            totalAktSpent: 301.11111111,
            dailyUsdcSpent: 75.123456789,
            totalUsdcSpent: 126.11111111,
            dailyUsdSpent: 276.11111111,
            totalUsdSpent: 427.222222221
          })
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByOwner.mockResolvedValue(1000);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result.totalSpent).toBe(427.22);
        expect(result.averagePerDay).toBe(213.61);
        expect(result.totalLeases).toBe(1000);
        expect(result.averageLeasesPerDay).toBe(500.0);
      });
    });
  });

  function setup(usageData?: BillingUsageRawResult[], totalLeases?: number) {
    const address = AkashAddressSeeder.create();
    const startDate = faker.date.past();
    const leasesCount = totalLeases ?? faker.number.int({ min: 1, max: 20 });

    const mockUsageData = usageData || [
      BillingUsageSeeder.create({
        date: format(startDate, "yyyy-MM-dd"),
        activeLeases: 1,
        dailyAktSpent: 5.5,
        totalAktSpent: 5.5,
        dailyUsdcSpent: 2.25,
        totalUsdcSpent: 2.25,
        dailyUsdSpent: 7.75,
        totalUsdSpent: 7.75
      }),
      BillingUsageSeeder.create({
        date: format(addDays(startDate, 1), "yyyy-MM-dd"),
        activeLeases: 2,
        dailyAktSpent: 3.2,
        totalAktSpent: 8.7,
        dailyUsdcSpent: 1.5,
        totalUsdcSpent: 3.75,
        dailyUsdSpent: 4.7,
        totalUsdSpent: 12.45
      }),
      BillingUsageSeeder.create({
        date: format(addDays(startDate, 2), "yyyy-MM-dd"),
        activeLeases: 1,
        dailyAktSpent: 2.1,
        totalAktSpent: 10.8,
        dailyUsdcSpent: 1.0,
        totalUsdcSpent: 4.75,
        dailyUsdSpent: 3.1,
        totalUsdSpent: 15.55
      })
    ];

    const usageRepository = stub<UsageRepository>({
      getHistory: jest.fn()
    });

    const leaseRepository = stub<LeaseRepository>({
      countByOwner: jest.fn()
    });

    const service = new UsageService(usageRepository, leaseRepository);

    usageRepository.getHistory.mockResolvedValue(mockUsageData);
    leaseRepository.countByOwner.mockResolvedValue(leasesCount);

    return {
      address,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(addDays(startDate, 30), "yyyy-MM-dd"),
      data: mockUsageData,
      service,
      usageRepository,
      leaseRepository,
      leasesCount
    };
  }
});
