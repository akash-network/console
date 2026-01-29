import { Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import type { CoinGeckoHttpService, CosmosHttpService } from "@akashnetwork/http-sdk";
import { mock } from "jest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { DashboardConfig } from "../../providers/config.provider";
import { StatsService } from "./stats.service";

describe(StatsService.name, () => {
  beforeEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  describe("getNetworkCapacity", () => {
    it("returns empty capacity when no providers found", async () => {
      const { service } = setup();

      jest.spyOn(Provider, "findAll").mockResolvedValue([]);

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
      const { service } = setup();

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

      jest.spyOn(Provider, "findAll").mockResolvedValue([mockProvider as unknown as Provider]);

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
      const { service } = setup();

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

      jest.spyOn(Provider, "findAll").mockResolvedValue(mockProviders as unknown as Provider[]);

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
      const { service } = setup();

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

      jest.spyOn(Provider, "findAll").mockResolvedValue(mockProviders as unknown as Provider[]);

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
      const { service } = setup();

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

      jest.spyOn(Provider, "findAll").mockResolvedValue([mockProvider as unknown as Provider]);

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

    it("queries providers with correct filters", async () => {
      const { service } = setup({ PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: 10 });

      const findAllSpy = jest.spyOn(Provider, "findAll").mockResolvedValue([]);

      await service.getNetworkCapacity();

      expect(findAllSpy).toHaveBeenCalledWith({
        where: {
          deletedHeight: null
        },
        include: [
          {
            required: true,
            model: ProviderSnapshot,
            as: "lastSuccessfulSnapshot",
            where: expect.objectContaining({
              checkDate: expect.any(Object)
            })
          }
        ]
      });
    });
  });

  function setup(input?: { PROVIDER_UPTIME_GRACE_PERIOD_MINUTES?: number }) {
    const cosmosHttpService = mock<CosmosHttpService>();
    const coinGeckoHttpService = mock<CoinGeckoHttpService>();
    const dashboardConfig: DashboardConfig = {
      PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: input?.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES ?? 15
    };

    const service = new StatsService(dashboardConfig, cosmosHttpService, coinGeckoHttpService);

    return {
      service,
      cosmosHttpService,
      coinGeckoHttpService,
      dashboardConfig
    };
  }
});
