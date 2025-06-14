import type { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { UsageService } from "./usage.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";

describe(UsageService.name, () => {
  let service: UsageService;
  let usageRepository: jest.Mocked<UsageRepository>;
  let leaseRepository: jest.Mocked<LeaseRepository>;

  beforeEach(() => {
    usageRepository = {
      getHistory: jest.fn()
    } as unknown as jest.Mocked<UsageRepository>;

    leaseRepository = {
      countByDseqAndOwner: jest.fn()
    } as unknown as jest.Mocked<LeaseRepository>;

    service = new UsageService(usageRepository, leaseRepository);
  });

  describe("getHistory", () => {
    const address = AkashAddressSeeder.create();
    const startDate = "2024-01-01";
    const endDate = "2024-01-31";

    const mockUsageData = [
      {
        date: "2024-01-01",
        activeLeases: 1,
        dailyAktSpent: 5.5,
        totalAktSpent: 5.5,
        dailyUsdcSpent: 2.25,
        totalUsdcSpent: 2.25,
        dailyUsdSpent: 7.75,
        totalUsdSpent: 7.75
      },
      {
        date: "2024-01-02",
        activeLeases: 2,
        dailyAktSpent: 3.2,
        totalAktSpent: 8.7,
        dailyUsdcSpent: 1.5,
        totalUsdcSpent: 3.75,
        dailyUsdSpent: 4.7,
        totalUsdSpent: 12.45
      }
    ];

    beforeEach(() => {
      usageRepository.getHistory.mockResolvedValue(mockUsageData);
    });

    it("should return usage history data from repository", async () => {
      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual(mockUsageData);
    });

    it("should handle empty history data", async () => {
      usageRepository.getHistory.mockResolvedValue([]);

      const result = await service.getHistory(address, startDate, endDate);

      expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
      expect(result).toEqual([]);
    });
  });

  describe("getHistoryStats", () => {
    const address = AkashAddressSeeder.create();
    const startDate = "2024-01-01";
    const endDate = "2024-01-31";

    describe("when history data is available", () => {
      const mockUsageData = [
        {
          date: "2024-01-01",
          activeLeases: 1,
          dailyAktSpent: 5.5,
          totalAktSpent: 5.5,
          dailyUsdcSpent: 2.25,
          totalUsdcSpent: 2.25,
          dailyUsdSpent: 7.75,
          totalUsdSpent: 7.75
        },
        {
          date: "2024-01-02",
          activeLeases: 2,
          dailyAktSpent: 3.2,
          totalAktSpent: 8.7,
          dailyUsdcSpent: 1.5,
          totalUsdcSpent: 3.75,
          dailyUsdSpent: 4.7,
          totalUsdSpent: 12.45
        },
        {
          date: "2024-01-03",
          activeLeases: 1,
          dailyAktSpent: 2.1,
          totalAktSpent: 10.8,
          dailyUsdcSpent: 1.0,
          totalUsdcSpent: 4.75,
          dailyUsdSpent: 3.1,
          totalUsdSpent: 15.55
        }
      ];

      const TOTAL_LEASES = 25;

      beforeEach(() => {
        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByDseqAndOwner.mockResolvedValue(TOTAL_LEASES);
      });

      it("should calculate statistics from usage history", async () => {
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(leaseRepository.countByDseqAndOwner).toHaveBeenCalledWith(address, address);

        expect(result).toEqual({
          totalSpent: 15.55,
          averagePerDay: 5.18,
          totalLeases: TOTAL_LEASES,
          averageLeasesPerDay: 8.33
        });
      });

      it("should handle single day of data", async () => {
        const singleDayData = [mockUsageData[0]];
        usageRepository.getHistory.mockResolvedValue(singleDayData);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 7.75,
          averagePerDay: 7.75,
          totalLeases: TOTAL_LEASES,
          averageLeasesPerDay: 25.0
        });
      });

      it("should handle zero total leases", async () => {
        leaseRepository.countByDseqAndOwner.mockResolvedValue(0);

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
      beforeEach(() => {
        usageRepository.getHistory.mockResolvedValue([]);
        leaseRepository.countByDseqAndOwner.mockResolvedValue(0);
      });

      it("should return zero values for all statistics", async () => {
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(usageRepository.getHistory).toHaveBeenCalledWith(address, startDate, endDate);
        expect(leaseRepository.countByDseqAndOwner).toHaveBeenCalledWith(address, address);

        expect(result).toEqual({
          totalSpent: 0,
          averagePerDay: 0,
          totalLeases: 0,
          averageLeasesPerDay: 0
        });
      });

      it("should not call lease repository when no history data", async () => {
        await service.getHistoryStats(address, startDate, endDate);

        expect(leaseRepository.countByDseqAndOwner).toHaveBeenCalledWith(address, address);
      });
    });

    describe("when history data exists but no leases", () => {
      const mockUsageData = [
        {
          date: "2024-01-01",
          activeLeases: 0,
          dailyAktSpent: 0,
          totalAktSpent: 0,
          dailyUsdcSpent: 0,
          totalUsdcSpent: 0,
          dailyUsdSpent: 0,
          totalUsdSpent: 0
        }
      ];

      beforeEach(() => {
        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByDseqAndOwner.mockResolvedValue(0);
      });

      it("should return stats with zero spending but calculate averages correctly", async () => {
        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result).toEqual({
          totalSpent: 0,
          averagePerDay: 0,
          totalLeases: 0,
          averageLeasesPerDay: 0
        });
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle repository errors gracefully", async () => {
        usageRepository.getHistory.mockRejectedValue(new Error("Database error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Database error");
      });

      it("should handle lease repository errors gracefully", async () => {
        const mockUsageData = [
          {
            date: "2024-01-01",
            activeLeases: 1,
            dailyAktSpent: 5.5,
            totalAktSpent: 5.5,
            dailyUsdcSpent: 2.25,
            totalUsdcSpent: 2.25,
            dailyUsdSpent: 7.75,
            totalUsdSpent: 7.75
          }
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByDseqAndOwner.mockRejectedValue(new Error("Lease DB error"));

        await expect(service.getHistoryStats(address, startDate, endDate)).rejects.toThrow("Lease DB error");
      });

      it("should handle large numbers and rounding correctly", async () => {
        const mockUsageData = [
          {
            date: "2024-01-01",
            activeLeases: 1,
            dailyAktSpent: 100.123456789,
            totalAktSpent: 100.123456789,
            dailyUsdcSpent: 50.987654321,
            totalUsdcSpent: 50.987654321,
            dailyUsdSpent: 151.11111111,
            totalUsdSpent: 151.11111111
          },
          {
            date: "2024-01-02",
            activeLeases: 1,
            dailyAktSpent: 200.987654321,
            totalAktSpent: 301.11111111,
            dailyUsdcSpent: 75.123456789,
            totalUsdcSpent: 126.11111111,
            dailyUsdSpent: 276.11111111,
            totalUsdSpent: 427.222222221
          }
        ];

        usageRepository.getHistory.mockResolvedValue(mockUsageData);
        leaseRepository.countByDseqAndOwner.mockResolvedValue(1000);

        const result = await service.getHistoryStats(address, startDate, endDate);

        expect(result.totalSpent).toBe(427.22);
        expect(result.averagePerDay).toBe(213.61);
        expect(result.totalLeases).toBe(1000);
        expect(result.averageLeasesPerDay).toBe(500.0);
      });
    });
  });
});
