import type { AkashBlock, Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { format, subHours } from "date-fns";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/core";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { DaySeeder } from "@test/seeders/day.seeder";
import { ProviderSeeder } from "@test/seeders/provider.seeder";
import { ProviderSnapshotSeeder } from "@test/seeders/provider-snapshot.seeder";

describe("Dashboard Data", () => {
  let providers: Provider[];
  let providerSnapshots: ProviderSnapshot[];
  let blocks: AkashBlock[];
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const yesterday = subHours(now, 24);
  const twoDaysAgo = subHours(now, 48);

  beforeAll(async () => {
    await initDb();

    await Promise.all([
      DaySeeder.createInDatabase({
        date: format(twoDaysAgo, "yyyy-MM-dd"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100
      }),
      DaySeeder.createInDatabase({
        date: format(yesterday, "yyyy-MM-dd"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200
      }),
      DaySeeder.createInDatabase({
        date: format(now, "yyyy-MM-dd"),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300
      })
    ]);

    providers = await Promise.all([ProviderSeeder.createInDatabase({ deletedHeight: null }), ProviderSeeder.createInDatabase({ deletedHeight: null })]);
    providerSnapshots = await Promise.all([
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: twoDaysAgo,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 101,
        activeGPU: 102,
        activeMemory: 103,
        activePersistentStorage: 104,
        activeEphemeralStorage: 105,
        pendingCPU: 106,
        pendingGPU: 107,
        pendingMemory: 108,
        pendingPersistentStorage: 109,
        pendingEphemeralStorage: 110,
        availableCPU: 111,
        availableGPU: 112,
        availableMemory: 113,
        availablePersistentStorage: 114,
        availableEphemeralStorage: 115
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: yesterday,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 201,
        activeGPU: 202,
        activeMemory: 203,
        activePersistentStorage: 204,
        activeEphemeralStorage: 205,
        pendingCPU: 206,
        pendingGPU: 207,
        pendingMemory: 208,
        pendingPersistentStorage: 209,
        pendingEphemeralStorage: 210,
        availableCPU: 211,
        availableGPU: 212,
        availableMemory: 213,
        availablePersistentStorage: 214,
        availableEphemeralStorage: 215
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: now,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 301,
        activeGPU: 302,
        activeMemory: 303,
        activePersistentStorage: 304,
        activeEphemeralStorage: 305,
        pendingCPU: 306,
        pendingGPU: 307,
        pendingMemory: 308,
        pendingPersistentStorage: 309,
        pendingEphemeralStorage: 310,
        availableCPU: 311,
        availableGPU: 312,
        availableMemory: 313,
        availablePersistentStorage: 314,
        availableEphemeralStorage: 315
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: twoDaysAgo,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 301,
        activeGPU: 302,
        activeMemory: 303,
        activePersistentStorage: 304,
        activeEphemeralStorage: 305,
        pendingCPU: 306,
        pendingGPU: 307,
        pendingMemory: 308,
        pendingPersistentStorage: 309,
        pendingEphemeralStorage: 310,
        availableCPU: 311,
        availableGPU: 312,
        availableMemory: 313,
        availablePersistentStorage: 314,
        availableEphemeralStorage: 315
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: yesterday,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 401,
        activeGPU: 402,
        activeMemory: 403,
        activePersistentStorage: 404,
        activeEphemeralStorage: 405,
        pendingCPU: 406,
        pendingGPU: 407,
        pendingMemory: 408,
        pendingPersistentStorage: 409,
        pendingEphemeralStorage: 410,
        availableCPU: 411,
        availableGPU: 412,
        availableMemory: 413,
        availablePersistentStorage: 414,
        availableEphemeralStorage: 415
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: now,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 501,
        activeGPU: 502,
        activeMemory: 503,
        activePersistentStorage: 504,
        activeEphemeralStorage: 505,
        pendingCPU: 506,
        pendingGPU: 507,
        pendingMemory: 508,
        pendingPersistentStorage: 509,
        pendingEphemeralStorage: 510,
        availableCPU: 511,
        availableGPU: 512,
        availableMemory: 513,
        availablePersistentStorage: 514,
        availableEphemeralStorage: 515
      })
    ]);
    await Promise.all([
      providers[0].update({
        lastSuccessfulSnapshotId: providerSnapshots[2].id
      }),
      providers[1].update({
        lastSuccessfulSnapshotId: providerSnapshots[5].id
      })
    ]);

    blocks = await Promise.all([
      BlockSeeder.createInDatabase({
        datetime: twoDaysAgo,
        height: 100
      }),
      BlockSeeder.createInDatabase({
        datetime: yesterday,
        height: 200
      }),
      BlockSeeder.createInDatabase({
        datetime: now,
        height: 300,
        isProcessed: true
      })
    ]);
  });

  afterAll(async () => {
    await closeConnections();
  });

  describe("GET /v1/dashboard-data", () => {
    it("returns data for dashboard", async () => {
      const response = await app.request("/v1/dashboard-data");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.now).toEqual(
        expect.objectContaining({
          height: blocks[2].height,
          date: blocks[2].datetime.toISOString(),
          activeLeaseCount: blocks[2].activeLeaseCount,
          totalLeaseCount: blocks[2].totalLeaseCount,
          activeCPU: blocks[2].activeCPU,
          activeGPU: blocks[2].activeGPU,
          activeMemory: blocks[2].activeMemory,
          activeStorage: blocks[2].activeEphemeralStorage + blocks[2].activePersistentStorage,
          dailyLeaseCount: blocks[2].totalLeaseCount - blocks[1].totalLeaseCount,
          dailyUAktSpent: blocks[2].totalUAktSpent - blocks[1].totalUAktSpent,
          dailyUUsdSpent: blocks[2].totalUUsdSpent - blocks[1].totalUUsdSpent,
          dailyUUsdcSpent: blocks[2].totalUUsdcSpent - blocks[1].totalUUsdcSpent,
          totalUAktSpent: blocks[2].totalUAktSpent,
          totalUUsdSpent: blocks[2].totalUUsdSpent,
          totalUUsdcSpent: blocks[2].totalUUsdcSpent
        })
      );
      expect(data.compare).toEqual(
        expect.objectContaining({
          height: blocks[1].height,
          date: blocks[1].datetime.toISOString(),
          activeLeaseCount: blocks[1].activeLeaseCount,
          totalLeaseCount: blocks[1].totalLeaseCount,
          activeCPU: blocks[1].activeCPU,
          activeGPU: blocks[1].activeGPU,
          activeMemory: blocks[1].activeMemory,
          activeStorage: blocks[1].activeEphemeralStorage + blocks[1].activePersistentStorage,
          dailyLeaseCount: blocks[1].totalLeaseCount - blocks[0].totalLeaseCount,
          dailyUAktSpent: blocks[1].totalUAktSpent - blocks[0].totalUAktSpent,
          dailyUUsdSpent: blocks[1].totalUUsdSpent - blocks[0].totalUUsdSpent,
          dailyUUsdcSpent: blocks[1].totalUUsdcSpent - blocks[0].totalUUsdcSpent,
          totalUAktSpent: blocks[1].totalUAktSpent,
          totalUUsdSpent: blocks[1].totalUUsdSpent,
          totalUUsdcSpent: blocks[1].totalUUsdcSpent
        })
      );
    });
  });
});
