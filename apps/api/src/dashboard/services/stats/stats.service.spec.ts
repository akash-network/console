import type { AkashBlock as Block, Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { Day } from "@akashnetwork/database/dbSchemas/base";
import type { CoinGeckoHttpService, CosmosHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { StatsRepository } from "../../repositories/stats";
import { StatsService } from "./stats.service";
import { isValidGraphDataName } from "./stats.types";

describe(StatsService.name, () => {
  describe("getNetworkCapacity", () => {
    it("returns empty capacity when no providers found", async () => {
      const { service } = setup();

      const result = await service.getNetworkCapacity();

      expect(result).toEqual({
        activeProviderCount: 0,
        resources: {
          cpu: { active: 0, pending: 0, available: 0, total: 0 },
          gpu: { active: 0, pending: 0, available: 0, total: 0 },
          memory: { active: 0, pending: 0, available: 0, total: 0 },
          storage: {
            ephemeral: { active: 0, pending: 0, available: 0, total: 0 },
            persistent: { active: 0, pending: 0, available: 0, total: 0 },
            total: { active: 0, pending: 0, available: 0, total: 0 }
          }
        }
      });
    });

    it("aggregates resources from single provider", async () => {
      const { service, statsRepository } = setup();

      const mockSnapshot = {
        activeCPU: 1000,
        pendingCPU: 200,
        availableCPU: 3000,
        activeGPU: 2,
        pendingGPU: 1,
        availableGPU: 5,
        activeMemory: 1073741824,
        pendingMemory: 536870912,
        availableMemory: 4294967296,
        activeEphemeralStorage: 10737418240,
        pendingEphemeralStorage: 5368709120,
        availableEphemeralStorage: 53687091200,
        activePersistentStorage: 21474836480,
        pendingPersistentStorage: 10737418240,
        availablePersistentStorage: 107374182400
      };

      const mockProvider = {
        hostUri: "https://provider1.example.com",
        lastSuccessfulSnapshot: mockSnapshot
      };

      statsRepository.findActiveProvidersWithSnapshots.mockResolvedValue([mockProvider as unknown as Provider]);

      const result = await service.getNetworkCapacity();

      expect(result).toEqual({
        activeProviderCount: 1,
        resources: {
          cpu: {
            active: 1000,
            pending: 200,
            available: 3000,
            total: 4200
          },
          gpu: {
            active: 2,
            pending: 1,
            available: 5,
            total: 8
          },
          memory: {
            active: 1073741824,
            pending: 536870912,
            available: 4294967296,
            total: 5905580032
          },
          storage: {
            ephemeral: {
              active: 10737418240,
              pending: 5368709120,
              available: 53687091200,
              total: 69793218560
            },
            persistent: {
              active: 21474836480,
              pending: 10737418240,
              available: 107374182400,
              total: 139586437120
            },
            total: {
              active: 32212254720,
              pending: 16106127360,
              available: 161061273600,
              total: 209379655680
            }
          }
        }
      });
    });

    it("aggregates resources from multiple providers", async () => {
      const { service, statsRepository } = setup();

      const mockSnapshot1 = {
        activeCPU: 1000,
        pendingCPU: 100,
        availableCPU: 2000,
        activeGPU: 1,
        pendingGPU: 0,
        availableGPU: 3,
        activeMemory: 1073741824,
        pendingMemory: 0,
        availableMemory: 2147483648,
        activeEphemeralStorage: 10737418240,
        pendingEphemeralStorage: 0,
        availableEphemeralStorage: 21474836480,
        activePersistentStorage: 5368709120,
        pendingPersistentStorage: 0,
        availablePersistentStorage: 10737418240
      };

      const mockSnapshot2 = {
        activeCPU: 500,
        pendingCPU: 50,
        availableCPU: 1000,
        activeGPU: 2,
        pendingGPU: 1,
        availableGPU: 5,
        activeMemory: 536870912,
        pendingMemory: 268435456,
        availableMemory: 1073741824,
        activeEphemeralStorage: 5368709120,
        pendingEphemeralStorage: 2684354560,
        availableEphemeralStorage: 10737418240,
        activePersistentStorage: 2684354560,
        pendingPersistentStorage: 1342177280,
        availablePersistentStorage: 5368709120
      };

      const mockProviders = [
        { hostUri: "https://provider1.example.com", lastSuccessfulSnapshot: mockSnapshot1 },
        { hostUri: "https://provider2.example.com", lastSuccessfulSnapshot: mockSnapshot2 }
      ];

      statsRepository.findActiveProvidersWithSnapshots.mockResolvedValue(mockProviders as unknown as Provider[]);

      const result = await service.getNetworkCapacity();

      expect(result).toEqual({
        activeProviderCount: 2,
        resources: {
          cpu: {
            active: 1500,
            pending: 150,
            available: 3000,
            total: 4650
          },
          gpu: {
            active: 3,
            pending: 1,
            available: 8,
            total: 12
          },
          memory: {
            active: 1610612736,
            pending: 268435456,
            available: 3221225472,
            total: 5100273664
          },
          storage: {
            ephemeral: {
              active: 16106127360,
              pending: 2684354560,
              available: 32212254720,
              total: 51002736640
            },
            persistent: {
              active: 8053063680,
              pending: 1342177280,
              available: 16106127360,
              total: 25501368320
            },
            total: {
              active: 24159191040,
              pending: 4026531840,
              available: 48318382080,
              total: 76504104960
            }
          }
        }
      });
    });

    it("deduplicates providers with the same hostUri", async () => {
      const { service, statsRepository } = setup();

      const mockSnapshot1 = {
        activeCPU: 1000,
        pendingCPU: 0,
        availableCPU: 2000,
        activeGPU: 1,
        pendingGPU: 0,
        availableGPU: 3,
        activeMemory: 1073741824,
        pendingMemory: 0,
        availableMemory: 2147483648,
        activeEphemeralStorage: 10737418240,
        pendingEphemeralStorage: 0,
        availableEphemeralStorage: 21474836480,
        activePersistentStorage: 5368709120,
        pendingPersistentStorage: 0,
        availablePersistentStorage: 10737418240
      };

      const mockSnapshot2 = {
        activeCPU: 500,
        pendingCPU: 50,
        availableCPU: 1000,
        activeGPU: 2,
        pendingGPU: 1,
        availableGPU: 5,
        activeMemory: 536870912,
        pendingMemory: 268435456,
        availableMemory: 1073741824,
        activeEphemeralStorage: 5368709120,
        pendingEphemeralStorage: 2684354560,
        availableEphemeralStorage: 10737418240,
        activePersistentStorage: 2684354560,
        pendingPersistentStorage: 1342177280,
        availablePersistentStorage: 5368709120
      };

      const mockProviders = [
        { hostUri: "https://provider1.example.com", lastSuccessfulSnapshot: mockSnapshot1 },
        { hostUri: "https://provider1.example.com", lastSuccessfulSnapshot: mockSnapshot2 }
      ];

      statsRepository.findActiveProvidersWithSnapshots.mockResolvedValue(mockProviders as unknown as Provider[]);

      const result = await service.getNetworkCapacity();

      expect(result.activeProviderCount).toBe(1);
      expect(result.resources.cpu).toEqual({
        active: 1000,
        pending: 0,
        available: 2000,
        total: 3000
      });
    });

    it("handles null values in snapshot fields", async () => {
      const { service, statsRepository } = setup();

      const mockSnapshot = {
        activeCPU: null,
        pendingCPU: undefined,
        availableCPU: 1000,
        activeGPU: 0,
        pendingGPU: null,
        availableGPU: 2,
        activeMemory: null,
        pendingMemory: null,
        availableMemory: 1073741824,
        activeEphemeralStorage: null,
        pendingEphemeralStorage: null,
        availableEphemeralStorage: 10737418240,
        activePersistentStorage: null,
        pendingPersistentStorage: null,
        availablePersistentStorage: 5368709120
      };

      const mockProvider = {
        hostUri: "https://provider1.example.com",
        lastSuccessfulSnapshot: mockSnapshot
      };

      statsRepository.findActiveProvidersWithSnapshots.mockResolvedValue([mockProvider as unknown as Provider]);

      const result = await service.getNetworkCapacity();

      expect(result).toEqual({
        activeProviderCount: 1,
        resources: {
          cpu: {
            active: 0,
            pending: 0,
            available: 1000,
            total: 1000
          },
          gpu: {
            active: 0,
            pending: 0,
            available: 2,
            total: 2
          },
          memory: {
            active: 0,
            pending: 0,
            available: 1073741824,
            total: 1073741824
          },
          storage: {
            ephemeral: {
              active: 0,
              pending: 0,
              available: 10737418240,
              total: 10737418240
            },
            persistent: {
              active: 0,
              pending: 0,
              available: 5368709120,
              total: 5368709120
            },
            total: {
              active: 0,
              pending: 0,
              available: 16106127360,
              total: 16106127360
            }
          }
        }
      });
    });

    it("calls findActiveProvidersWithSnapshots", async () => {
      const { service, statsRepository } = setup();

      await service.getNetworkCapacity();

      expect(statsRepository.findActiveProvidersWithSnapshots).toHaveBeenCalledOnce();
    });
  });

  describe("isValidGraphDataName", () => {
    it("returns true for valid graph data names", () => {
      expect(isValidGraphDataName("dailyUAktSpent")).toBe(true);
      expect(isValidGraphDataName("totalAktBurnedForAct")).toBe(true);
      expect(isValidGraphDataName("collateralRatio")).toBe(true);
      expect(isValidGraphDataName("vaultAkt")).toBe(true);
      expect(isValidGraphDataName("outstandingAct")).toBe(true);
    });

    it("returns false for invalid graph data names", () => {
      expect(isValidGraphDataName("invalidName")).toBe(false);
      expect(isValidGraphDataName("")).toBe(false);
      expect(isValidGraphDataName("randomMetric")).toBe(false);
    });
  });

  describe("getGraphData", () => {
    const day1 = new Date("2024-01-01");
    const day2 = new Date("2024-01-02");
    const day3 = new Date("2024-01-03");

    it("returns snapshot-derived values for totalAktBurnedForAct", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: 100 } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 300 } },
        { date: day3, lastBlock: { totalUaktBurnedForUact: 600 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { totalUaktBurnedForUact: 600 }, { totalUaktBurnedForUact: 300 });

      const result = await service.getGraphData("totalAktBurnedForAct");

      expect(result).toEqual({
        currentValue: 600,
        compareValue: 300,
        snapshots: [
          { date: day1, value: 100 },
          { date: day2, value: 300 },
          { date: day3, value: 600 }
        ]
      });
    });

    it("returns relative snapshot-derived values for dailyAktBurnedForAct", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: 100 } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 300 } },
        { date: day3, lastBlock: { totalUaktBurnedForUact: 600 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { totalUaktBurnedForUact: 600 }, { totalUaktBurnedForUact: 300 }, { totalUaktBurnedForUact: 100 });

      const result = await service.getGraphData("dailyAktBurnedForAct");

      expect(result).toEqual({
        currentValue: 300,
        compareValue: 200,
        snapshots: [
          { date: day1, value: 100 },
          { date: day2, value: 200 },
          { date: day3, value: 300 }
        ]
      });
    });

    it("returns snapshot-derived values for totalActMinted", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUactMinted: 500 } },
        { date: day2, lastBlock: { totalUactMinted: 1200 } },
        { date: day3, lastBlock: { totalUactMinted: 2000 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { totalUactMinted: 2000 }, { totalUactMinted: 1200 });

      const result = await service.getGraphData("totalActMinted");

      expect(result).toEqual({
        currentValue: 2000,
        compareValue: 1200,
        snapshots: [
          { date: day1, value: 500 },
          { date: day2, value: 1200 },
          { date: day3, value: 2000 }
        ]
      });
    });

    it("computes netAktBurned as difference of totalUaktBurnedForUact minus totalUaktReminted", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: 1000, totalUaktReminted: 200 } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 2000, totalUaktReminted: 500 } },
        { date: day3, lastBlock: { totalUaktBurnedForUact: 3500, totalUaktReminted: 1000 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(
        statsRepository,
        { totalUaktBurnedForUact: 3500, totalUaktReminted: 1000 },
        { totalUaktBurnedForUact: 2000, totalUaktReminted: 500 }
      );

      const result = await service.getGraphData("netAktBurned");

      expect(result).toEqual({
        currentValue: 2500,
        compareValue: 1500,
        snapshots: [
          { date: day1, value: 800 },
          { date: day2, value: 1500 },
          { date: day3, value: 2500 }
        ]
      });
    });

    it("computes dailyNetAktBurned as relative difference", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: 1000, totalUaktReminted: 200 } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 2000, totalUaktReminted: 500 } },
        { date: day3, lastBlock: { totalUaktBurnedForUact: 3500, totalUaktReminted: 1000 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(
        statsRepository,
        { totalUaktBurnedForUact: 3500, totalUaktReminted: 1000 },
        { totalUaktBurnedForUact: 2000, totalUaktReminted: 500 },
        { totalUaktBurnedForUact: 1000, totalUaktReminted: 200 }
      );

      const result = await service.getGraphData("dailyNetAktBurned");

      expect(result).toEqual({
        currentValue: 1000,
        compareValue: 700,
        snapshots: [
          { date: day1, value: 800 },
          { date: day2, value: 700 },
          { date: day3, value: 1000 }
        ]
      });
    });

    it("returns snapshot-derived values for outstandingAct", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { outstandingUact: 5000 } },
        { date: day2, lastBlock: { outstandingUact: 7500 } },
        { date: day3, lastBlock: { outstandingUact: 10000 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { outstandingUact: 10000 }, { outstandingUact: 7500 });

      const result = await service.getGraphData("outstandingAct");

      expect(result).toEqual({
        currentValue: 10000,
        compareValue: 7500,
        snapshots: [
          { date: day1, value: 5000 },
          { date: day2, value: 7500 },
          { date: day3, value: 10000 }
        ]
      });
    });

    it("returns snapshot-derived values for vaultAkt", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { vaultUakt: 3000 } },
        { date: day2, lastBlock: { vaultUakt: 4000 } },
        { date: day3, lastBlock: { vaultUakt: 5000 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { vaultUakt: 5000 }, { vaultUakt: 4000 });

      const result = await service.getGraphData("vaultAkt");

      expect(result).toEqual({
        currentValue: 5000,
        compareValue: 4000,
        snapshots: [
          { date: day1, value: 3000 },
          { date: day2, value: 4000 },
          { date: day3, value: 5000 }
        ]
      });
    });

    it("handles null BME field values as zero", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: null } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 500 } }
      ] as unknown as Day[]);
      mockBmeDashboardData(statsRepository, { totalUaktBurnedForUact: 500 });

      const result = await service.getGraphData("totalAktBurnedForAct");

      expect(result).toEqual({
        currentValue: 500,
        compareValue: 0,
        snapshots: [
          { date: day1, value: 0 },
          { date: day2, value: 500 }
        ]
      });
    });

    it("returns zeros when no snapshots exist for BME metric", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([]);
      mockBmeDashboardData(statsRepository);

      const result = await service.getGraphData("totalAktBurnedForAct");

      expect(result).toEqual({
        currentValue: 0,
        compareValue: 0,
        snapshots: []
      });
    });

    it("delegates collateralRatio to repository", async () => {
      const { service, statsRepository } = setup();

      statsRepository.findCollateralRatio.mockResolvedValue([
        { date: day1, collateralRatio: 1.5 },
        { date: day2, collateralRatio: 1.8 },
        { date: day3, collateralRatio: 2.0 }
      ]);
      mockBmeDashboardData(statsRepository, { collateralRatio: 2.0 });

      const result = await service.getGraphData("collateralRatio");

      expect(result).toEqual({
        currentValue: 2.0,
        compareValue: 1.8,
        snapshots: [
          { date: day1, value: 1.5 },
          { date: day2, value: 1.8 },
          { date: day3, value: 2.0 }
        ]
      });
      expect(statsRepository.findCollateralRatio).toHaveBeenCalledOnce();
    });

    it("appends latest block to snapshots when its date is after the last snapshot", async () => {
      const { service, statsRepository } = setup();

      const latestBlock = {
        datetime: new Date("2024-01-04T06:00:00Z"),
        totalUaktBurnedForUact: 900
      };

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { totalUaktBurnedForUact: 100 } },
        { date: day2, lastBlock: { totalUaktBurnedForUact: 300 } },
        { date: day3, lastBlock: { totalUaktBurnedForUact: 600 } }
      ] as unknown as Day[]);
      statsRepository.findLatestBlockWithAttributes.mockResolvedValue(latestBlock as unknown as Block);
      mockBmeDashboardData(statsRepository, { totalUaktBurnedForUact: 900 }, { totalUaktBurnedForUact: 600 });

      const result = await service.getGraphData("totalAktBurnedForAct");

      expect(result.snapshots).toHaveLength(4);
      expect(result.snapshots[3]).toEqual({ date: latestBlock.datetime, value: 900 });
    });

    it("uses getDashboardData for non-BME metric currentValue and compareValue", async () => {
      const { service, statsRepository } = setup();

      const latestBlock = {
        datetime: new Date("2024-01-03T12:00:00Z"),
        height: 300,
        activeLeaseCount: 50,
        totalLeaseCount: 200,
        totalUAktSpent: 1000,
        totalUUsdcSpent: 1500,
        totalUActSpent: 500,
        totalUUsdSpent: 3000,
        activeCPU: 500,
        activeGPU: 10,
        activeMemory: 1024,
        activeEphemeralStorage: 2048,
        activePersistentStorage: 4096,
        isProcessed: true
      };

      const compareBlock = {
        datetime: new Date("2024-01-02T12:00:00Z"),
        height: 200,
        activeLeaseCount: 40,
        totalLeaseCount: 150,
        totalUAktSpent: 800,
        totalUUsdcSpent: 1200,
        totalUActSpent: 300,
        totalUUsdSpent: 2000,
        activeCPU: 400,
        activeGPU: 8,
        activeMemory: 800,
        activeEphemeralStorage: 1500,
        activePersistentStorage: 3000
      };

      const secondCompareBlock = {
        datetime: new Date("2024-01-01T12:00:00Z"),
        height: 100,
        totalLeaseCount: 100,
        totalUAktSpent: 500,
        totalUUsdcSpent: 800,
        totalUActSpent: 200,
        totalUUsdSpent: 1200
      };

      statsRepository.findLatestProcessedBlock.mockResolvedValue(latestBlock as unknown as Block);
      statsRepository.findFirstBlockSince.mockImplementation((since: Date) => {
        if (since < new Date("2024-01-02T00:00:00Z")) {
          return Promise.resolve(secondCompareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
        }
        return Promise.resolve(compareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
      });

      statsRepository.findDailyBlockSnapshots.mockResolvedValue([
        { date: day1, lastBlock: { activeCPU: 300 } },
        { date: day2, lastBlock: { activeCPU: 400 } },
        { date: day3, lastBlock: { activeCPU: 500 } }
      ] as unknown as Day[]);

      const result = await service.getGraphData("activeCPU");

      expect(result.currentValue).toBe(500);
      expect(result.compareValue).toBe(400);
      expect(result.snapshots).toHaveLength(3);
    });
  });

  describe("getDashboardData", () => {
    it("combines totalUUsdcSpent and totalUActSpent into totalUActSpent and dailyUActSpent", async () => {
      const { service, statsRepository } = setup();

      const latestBlock = {
        datetime: new Date("2024-01-03T12:00:00Z"),
        height: 300,
        activeLeaseCount: 50,
        totalLeaseCount: 200,
        totalUAktSpent: 1000,
        totalUUsdcSpent: 1500,
        totalUActSpent: 500,
        totalUUsdSpent: 3000,
        activeCPU: 500,
        activeGPU: 10,
        activeMemory: 1024,
        activeEphemeralStorage: 2048,
        activePersistentStorage: 4096,
        isProcessed: true
      };

      const compareBlock = {
        datetime: new Date("2024-01-02T12:00:00Z"),
        height: 200,
        activeLeaseCount: 40,
        totalLeaseCount: 150,
        totalUAktSpent: 800,
        totalUUsdcSpent: 1200,
        totalUActSpent: 300,
        totalUUsdSpent: 2000,
        activeCPU: 400,
        activeGPU: 8,
        activeMemory: 800,
        activeEphemeralStorage: 1500,
        activePersistentStorage: 3000
      };

      const secondCompareBlock = {
        datetime: new Date("2024-01-01T12:00:00Z"),
        height: 100,
        activeLeaseCount: 30,
        totalLeaseCount: 100,
        totalUAktSpent: 500,
        totalUUsdcSpent: 800,
        totalUActSpent: 200,
        totalUUsdSpent: 1200,
        activeCPU: 300,
        activeGPU: 5,
        activeMemory: 600,
        activeEphemeralStorage: 1000,
        activePersistentStorage: 2000
      };

      statsRepository.findLatestProcessedBlock.mockResolvedValue(latestBlock as unknown as Block);
      statsRepository.findFirstBlockSince.mockImplementation((since: Date) => {
        if (since < new Date("2024-01-02T00:00:00Z")) {
          return Promise.resolve(secondCompareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
        }
        return Promise.resolve(compareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
      });

      const result = await service.getDashboardData();

      expect(result.now.totalUActSpent).toBe(1500 + 500);
      expect(result.now.dailyUActSpent).toBe(1500 + 500 - (1200 + 300));
      expect(result.compare.totalUActSpent).toBe(1200 + 300);
      expect(result.compare.dailyUActSpent).toBe(1200 + 300 - (800 + 200));
    });

    it("handles null totalUUsdcSpent and totalUActSpent as zero", async () => {
      const { service, statsRepository } = setup();

      const latestBlock = {
        datetime: new Date("2024-01-03T12:00:00Z"),
        height: 300,
        activeLeaseCount: 10,
        totalLeaseCount: 50,
        totalUAktSpent: 100,
        totalUUsdcSpent: null,
        totalUActSpent: null,
        totalUUsdSpent: 200,
        activeCPU: 100,
        activeGPU: 1,
        activeMemory: 512,
        activeEphemeralStorage: 1024,
        activePersistentStorage: 2048,
        isProcessed: true
      };

      const compareBlock = {
        datetime: new Date("2024-01-02T12:00:00Z"),
        height: 200,
        activeLeaseCount: 5,
        totalLeaseCount: 30,
        totalUAktSpent: 50,
        totalUUsdcSpent: 100,
        totalUActSpent: null,
        totalUUsdSpent: 100,
        activeCPU: 50,
        activeGPU: 0,
        activeMemory: 256,
        activeEphemeralStorage: 512,
        activePersistentStorage: 1024
      };

      const secondCompareBlock = {
        datetime: new Date("2024-01-01T12:00:00Z"),
        height: 100,
        activeLeaseCount: 0,
        totalLeaseCount: 10,
        totalUAktSpent: 0,
        totalUUsdcSpent: null,
        totalUActSpent: null,
        totalUUsdSpent: 0,
        activeCPU: 0,
        activeGPU: 0,
        activeMemory: 0,
        activeEphemeralStorage: 0,
        activePersistentStorage: 0
      };

      statsRepository.findLatestProcessedBlock.mockResolvedValue(latestBlock as unknown as Block);
      statsRepository.findFirstBlockSince.mockImplementation((since: Date) => {
        if (since < new Date("2024-01-02T00:00:00Z")) {
          return Promise.resolve(secondCompareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
        }
        return Promise.resolve(compareBlock) as unknown as ReturnType<typeof statsRepository.findFirstBlockSince>;
      });

      const result = await service.getDashboardData();

      expect(result.now.totalUActSpent).toBe(0);
      expect(result.now.dailyUActSpent).toBe(-100);
      expect(result.compare.totalUActSpent).toBe(100);
      expect(result.compare.dailyUActSpent).toBe(100);
    });
  });

  describe("getBmeDashboardData", () => {
    it("returns dashboard data with computed daily values", async () => {
      const { service, statsRepository } = setup();

      mockBmeDashboardData(
        statsRepository,
        {
          totalUaktBurnedForUact: 1000,
          totalUactMinted: 500,
          totalUactBurnedForUakt: 200,
          totalUaktReminted: 100,
          outstandingUact: 800,
          vaultUakt: 5000,
          collateralRatio: 1.5
        },
        {
          totalUaktBurnedForUact: 700,
          totalUactMinted: 350,
          totalUactBurnedForUakt: 150,
          totalUaktReminted: 70,
          outstandingUact: 600,
          vaultUakt: 4000,
          collateralRatio: 1.4
        },
        {
          totalUaktBurnedForUact: 400,
          totalUactMinted: 200,
          totalUactBurnedForUakt: 100,
          totalUaktReminted: 40,
          outstandingUact: 400,
          vaultUakt: 3000,
          collateralRatio: 1.3
        }
      );

      const result = await service.getBmeDashboardData();

      expect(result.now.collateralRatio).toBe(1.5);
      expect(result.now.dailyAktBurnedForAct).toBe(300);
      expect(result.now.dailyActMinted).toBe(150);
      expect(result.now.dailyActBurnedForAkt).toBe(50);
      expect(result.now.dailyAktReminted).toBe(30);
      expect(result.now.netAktBurned).toBe(900);
      expect(result.now.dailyNetAktBurned).toBe(270);
      expect(result.compare.dailyAktBurnedForAct).toBe(300);
      expect(result.compare.dailyActMinted).toBe(150);
    });

    it("recalculates collateral ratio from AKT price when ratio is zero but vault and outstanding are positive", async () => {
      const { service, statsRepository, coinGeckoHttpService } = setup();

      mockBmeDashboardData(statsRepository, { collateralRatio: 0, outstandingUact: 2000, vaultUakt: 1000 });
      coinGeckoHttpService.getMarketData.mockResolvedValue({
        market_data: {
          current_price: { usd: 4 },
          total_volume: { usd: 0 },
          market_cap: { usd: 0 },
          price_change_24h: 0,
          price_change_percentage_24h: 0
        },
        market_cap_rank: 0
      } as never);

      const result = await service.getBmeDashboardData();

      expect(result.now.collateralRatio).toBe(2);
      expect(coinGeckoHttpService.getMarketData).toHaveBeenCalledWith("akash-network");
    });

    it("keeps collateral ratio as zero when AKT price fetch fails", async () => {
      const { service, statsRepository, coinGeckoHttpService } = setup();

      mockBmeDashboardData(statsRepository, { collateralRatio: 0, outstandingUact: 2000, vaultUakt: 1000 });
      coinGeckoHttpService.getMarketData.mockRejectedValue(new Error("API error"));

      const result = await service.getBmeDashboardData();

      expect(result.now.collateralRatio).toBe(0);
    });

    it("does not recalculate collateral ratio when outstandingUact is zero", async () => {
      const { service, statsRepository, coinGeckoHttpService } = setup();

      mockBmeDashboardData(statsRepository, { collateralRatio: 0, outstandingUact: 0, vaultUakt: 1000 });

      const result = await service.getBmeDashboardData();

      expect(result.now.collateralRatio).toBe(0);
      expect(coinGeckoHttpService.getMarketData).not.toHaveBeenCalled();
    });
  });

  function setup() {
    cacheEngine.clearAllKeyInCache();

    const statsRepository = mock<StatsRepository>();
    const cosmosHttpService = mock<CosmosHttpService>();
    const coinGeckoHttpService = mock<CoinGeckoHttpService>();

    statsRepository.findActiveProvidersWithSnapshots.mockResolvedValue([]);

    const service = new StatsService(statsRepository, cosmosHttpService, coinGeckoHttpService);

    return {
      service,
      statsRepository,
      cosmosHttpService,
      coinGeckoHttpService
    };
  }

  function mockBmeDashboardData(
    statsRepository: ReturnType<typeof setup>["statsRepository"],
    nowOverrides: Record<string, number> = {},
    compareOverrides: Record<string, number> = {},
    secondCompareOverrides: Record<string, number> = {}
  ) {
    const emptyRow = {
      datetime: new Date("2024-01-03T12:00:00Z"),
      outstandingUact: 0,
      vaultUakt: 0,
      collateralRatio: 0,
      totalUaktBurnedForUact: 0,
      totalUactMinted: 0,
      totalUactBurnedForUakt: 0,
      totalUaktReminted: 0
    };
    statsRepository.findBmeDashboardData.mockResolvedValue({
      now: { ...emptyRow, ...nowOverrides },
      compare: { ...emptyRow, datetime: new Date("2024-01-02T12:00:00Z"), ...compareOverrides },
      secondCompare: { ...emptyRow, datetime: new Date("2024-01-01T12:00:00Z"), ...secondCompareOverrides }
    });
  }
});
