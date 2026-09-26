import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Blocks, NetworkRollups, NetworkState } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { NetworkStatsService } from "@src/services/network-stats/network-stats.service";

describe(NetworkStatsService.name, () => {
  it("returns the current network state at its aggregation height with the most recent closed days", async () => {
    const { service } = await setup();

    const stats = await service.getStats({ days: 1 });

    expect(stats).toEqual({
      height: 20,
      datetime: "2026-08-12T00:00:06.000Z",
      activeLeaseCount: 5,
      totalLeaseCount: 40,
      activeProviderCount: 3,
      active: { cpuUnits: 1000, gpuUnits: 2, memoryBytes: 4096, ephemeralStorageBytes: 8192, persistentStorageBytes: 0 },
      totalSpent: { uakt: "123.500000000000000000", uusdc: "0.000000000000000000", uact: "7.000000000000000000" },
      daily: [
        {
          date: "2026-08-11",
          closeHeight: 19,
          activeLeaseCount: 4,
          totalLeaseCount: 39,
          dailyLeaseCount: 2,
          activeProviderCount: 3,
          active: { cpuUnits: 900, gpuUnits: 1, memoryBytes: 2048, ephemeralStorageBytes: 4096, persistentStorageBytes: 0 },
          totalSpent: { uakt: "120.000000000000000000", uusdc: "0.000000000000000000", uact: "6.000000000000000000" },
          dailySpent: { uakt: "10.000000000000000000", uusdc: "0.000000000000000000", uact: "1.000000000000000000" },
          dailyUsdSpent: "0.000030000000000000"
        }
      ]
    });
  });

  it("omits the daily series when zero days are requested", async () => {
    const { service } = await setup();

    expect((await service.getStats({ days: 0 }))?.daily).toEqual([]);
  });

  it("returns null before the first block has been aggregated", async () => {
    const { service, db } = await setup();
    await db.delete(NetworkState);

    expect(await service.getStats({ days: 30 })).toBeNull();
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(NetworkRollups);
    await db.delete(NetworkState);
    await db.delete(Blocks);

    await db
      .insert(Blocks)
      .values({ height: 20, datetime: new Date("2026-08-12T00:00:06Z"), hash: Buffer.from("aa20", "hex"), parentHash: null, proposerAddress: "P", txCount: 0 });
    await db.insert(NetworkState).values({
      id: 1,
      lastAggregatedHeight: 20,
      lastAggregatedAt: new Date("2026-08-12T00:00:06Z"),
      activeLeaseCount: 5,
      totalLeaseCount: 40,
      activeProviderCount: 3,
      activeCpuUnits: 1000,
      activeGpuUnits: 2,
      activeMemoryBytes: 4096,
      activeEphemeralStorageBytes: 8192,
      activePersistentStorageBytes: 0,
      totalUaktSpent: "123.5",
      totalUusdcSpent: "0",
      totalUactSpent: "7"
    });
    await db
      .insert(NetworkRollups)
      .values([
        buildDay("2026-08-10", 9, { totalUaktSpent: "110", dailyUaktSpent: "110" }),
        buildDay("2026-08-11", 19, { totalUaktSpent: "120", dailyUaktSpent: "10", dailyUsdSpent: "0.00003" })
      ]);

    const service = container.resolve(NetworkStatsService);
    return { service, db };
  }

  function buildDay(date: string, closeHeight: number, overrides: Partial<typeof NetworkRollups.$inferInsert>): typeof NetworkRollups.$inferInsert {
    return {
      date,
      closeHeight,
      closeAt: new Date(`${date}T23:59:59Z`),
      activeLeaseCount: 4,
      totalLeaseCount: 39,
      dailyLeaseCount: 2,
      activeProviderCount: 3,
      activeCpuUnits: 900,
      activeGpuUnits: 1,
      activeMemoryBytes: 2048,
      activeEphemeralStorageBytes: 4096,
      activePersistentStorageBytes: 0,
      totalUaktSpent: "120",
      totalUusdcSpent: "0",
      totalUactSpent: "6",
      dailyUaktSpent: "10",
      dailyUusdcSpent: "0",
      dailyUactSpent: "1",
      dailyUsdSpent: null,
      aktPriceUsed: null,
      usdComputedAt: null,
      ...overrides
    };
  }
});
