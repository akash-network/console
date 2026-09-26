import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import type { ChainIndexerApiClient } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { ChainIndexerDashboardStatsService } from "@src/chain-indexer/services/dashboard-stats/chain-indexer-dashboard-stats.service";

type GetNetworkStatsResponse = Awaited<ReturnType<ChainIndexerApiClient["v1"]["getNetworkStats"]>>;
type NetworkDay = GetNetworkStatsResponse["data"]["daily"][number];

describe(ChainIndexerDashboardStatsService.name, () => {
  it("serves the legacy now block from the api role's live network stats", async () => {
    const { service } = setup({ datetime: "2026-09-26T20:00:00.000Z", daily: [day("2026-09-25", 900, 80), day("2026-09-24", 800, 70)] });

    const { now } = await service.getDashboardData();

    expect(now).toEqual({
      date: "2026-09-26T20:00:00.000Z",
      height: 1000,
      activeLeaseCount: 12,
      totalLeaseCount: 1000,
      dailyLeaseCount: 100,
      totalUAktSpent: 5000,
      dailyUAktSpent: 4100,
      totalUActSpent: 300,
      dailyUActSpent: 120,
      totalUUsdcSpent: 300,
      dailyUUsdcSpent: 120,
      totalUUsdSpent: 0,
      dailyUUsdSpent: 0,
      activeCPU: 4000,
      activeGPU: 2,
      activeMemory: 8192,
      activeStorage: 4096
    });
  });

  it("picks the day close nearest to 24 hours before the latest block as the compare point", async () => {
    const { service } = setup({ datetime: "2026-09-26T02:00:00.000Z", daily: [day("2026-09-25", 900, 80), day("2026-09-24", 800, 70)] });

    const { now, compare } = await service.getDashboardData();

    expect(compare).toMatchObject({ date: "2026-09-25T00:00:00.000Z", height: 70, totalLeaseCount: 800, dailyLeaseCount: 8, dailyUAktSpent: 8 });
    expect(now.dailyLeaseCount).toBe(200);
  });

  it("asks the api role for three closed days with a request deadline", async () => {
    const { service, api } = setup({ datetime: "2026-09-26T02:00:00.000Z", daily: [] });

    await service.getDashboardData();

    expect(api.v1.getNetworkStats).toHaveBeenCalledWith({ days: 3 }, { signal: expect.any(AbortSignal) });
  });

  it("compares against the live block itself when no day has closed yet", async () => {
    const { service } = setup({ datetime: "2026-09-26T02:00:00.000Z", daily: [] });

    const { now, compare } = await service.getDashboardData();

    expect(compare.height).toBe(1000);
    expect(now.dailyLeaseCount).toBe(0);
    expect(compare.dailyLeaseCount).toBe(0);
  });

  function day(date: string, totalLeaseCount: number, closeHeight: number): NetworkDay {
    return {
      date,
      closeHeight,
      activeLeaseCount: 10,
      totalLeaseCount,
      dailyLeaseCount: 8,
      activeProviderCount: 3,
      active: { cpuUnits: 3000, gpuUnits: 1, memoryBytes: 4096, ephemeralStorageBytes: 1024, persistentStorageBytes: 1024 },
      totalSpent: { uakt: `${totalLeaseCount}.000000000000000000`, uusdc: "100", uact: "80" },
      dailySpent: { uakt: "8", uusdc: "1", uact: "1" },
      dailyUsdSpent: "1.5"
    };
  }

  function setup(input: { datetime: string; daily: NetworkDay[] }) {
    const api = mockDeep<ChainIndexerApiClient>();
    api.v1.getNetworkStats.mockResolvedValue({
      data: {
        height: 1000,
        datetime: input.datetime,
        activeLeaseCount: 12,
        totalLeaseCount: 1000,
        activeProviderCount: 5,
        active: { cpuUnits: 4000, gpuUnits: 2, memoryBytes: 8192, ephemeralStorageBytes: 4000, persistentStorageBytes: 96 },
        totalSpent: { uakt: "5000.000000000000000000", uusdc: "200", uact: "100" },
        daily: input.daily
      }
    });
    const config: ChainIndexerConfig = { CHAIN_INDEXER_API_BASE_URL: "https://chain-indexer.test", CHAIN_INDEXER_REQUEST_TIMEOUT_MS: 10_000 };
    const service = new ChainIndexerDashboardStatsService(api, config);
    return { service, api };
  }
});
