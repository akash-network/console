import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { createApp } from "@src/app";
import type { GetNetworkStatsResponse } from "@src/http-schemas/network-stats.schema";
import { NetworkStatsService } from "@src/services/network-stats/network-stats.service";

describe("networkStatsRouter", () => {
  it("returns the network stats with the requested number of days", async () => {
    const { app, networkStats } = setup();
    const stats = buildStats();
    networkStats.getStats.mockResolvedValue(stats);

    const response = await app.request("/v1/network-stats?days=7");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: stats });
    expect(networkStats.getStats).toHaveBeenCalledWith({ days: 7 });
  });

  it("answers 404 until the first block has been aggregated", async () => {
    const { app, networkStats } = setup();
    networkStats.getStats.mockResolvedValue(null);

    const response = await app.request("/v1/network-stats");

    expect(response.status).toBe(404);
    expect(networkStats.getStats).toHaveBeenCalledWith({ days: 30 });
  });

  function setup() {
    const networkStats = mock<NetworkStatsService>();
    container.registerInstance(NetworkStatsService, networkStats);
    return { app: createApp(), networkStats };
  }

  function buildStats(): GetNetworkStatsResponse["data"] {
    return {
      height: 1,
      datetime: "2026-08-11T00:00:00.000Z",
      activeLeaseCount: 0,
      totalLeaseCount: 0,
      activeProviderCount: 0,
      active: { cpuUnits: 0, gpuUnits: 0, memoryBytes: 0, ephemeralStorageBytes: 0, persistentStorageBytes: 0 },
      totalSpent: { uakt: "0", uusdc: "0", uact: "0" },
      daily: []
    };
  }
});
