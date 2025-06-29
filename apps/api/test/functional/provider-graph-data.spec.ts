import type { Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { format, subDays } from "date-fns";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/core";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { DaySeeder } from "@test/seeders/day.seeder";
import { ProviderSeeder } from "@test/seeders/provider.seeder";
import { ProviderSnapshotSeeder } from "@test/seeders/provider-snapshot.seeder";

describe("Provider Graph Data", () => {
  let providers: Provider[];
  let providerSnapshots: ProviderSnapshot[];
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const yesterday = subDays(date, 1);
  const twoDaysAgo = subDays(date, 2);
  const threeDaysAgo = subDays(date, 3);

  beforeAll(async () => {
    await initDb();

    await Promise.all([
      DaySeeder.createInDatabase({
        date: format(threeDaysAgo, "yyyy-MM-dd"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100
      }),
      DaySeeder.createInDatabase({
        date: format(twoDaysAgo, "yyyy-MM-dd"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200
      }),
      DaySeeder.createInDatabase({
        date: format(yesterday, "yyyy-MM-dd"),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300
      })
    ]);

    providers = await Promise.all([ProviderSeeder.createInDatabase(), ProviderSeeder.createInDatabase()]);
    providerSnapshots = await Promise.all([
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: threeDaysAgo,
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
        checkDate: twoDaysAgo,
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
        checkDate: yesterday,
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
        checkDate: threeDaysAgo,
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
        checkDate: twoDaysAgo,
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
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: yesterday,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 601,
        activeGPU: 602,
        activeMemory: 603,
        activePersistentStorage: 604,
        activeEphemeralStorage: 605,
        pendingCPU: 606,
        pendingGPU: 607,
        pendingMemory: 608,
        pendingPersistentStorage: 609,
        pendingEphemeralStorage: 610,
        availableCPU: 611,
        availableGPU: 612,
        availableMemory: 613,
        availablePersistentStorage: 614,
        availableEphemeralStorage: 615
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

    await Promise.all([
      BlockSeeder.createInDatabase({
        datetime: threeDaysAgo,
        height: 100
      }),
      BlockSeeder.createInDatabase({
        datetime: twoDaysAgo,
        height: 200
      }),
      BlockSeeder.createInDatabase({
        datetime: yesterday,
        height: 300,
        isProcessed: true
      })
    ]);
  });

  afterAll(async () => {
    await closeConnections();
  });

  describe("GET /v1/provider-graph-data/{dataName}", () => {
    ["count", "cpu", "gpu", "memory", "storage"].forEach(dataName => {
      it(`returns provider graph data for ${dataName}`, async () => {
        const response = await app.request(`/v1/provider-graph-data/${dataName}`);

        const data = (await response.json()) as any;

        expect(response.status).toBe(200);

        expect(data).toEqual({
          currentValue: data.now[dataName],
          compareValue: data.compare[dataName],
          snapshots: [
            { date: format(threeDaysAgo, "yyyy-MM-dd") + "T00:00:00.000Z", value: expect.any(Number) },
            { date: format(twoDaysAgo, "yyyy-MM-dd") + "T00:00:00.000Z", value: data.compare[dataName] },
            { date: format(yesterday, "yyyy-MM-dd") + "T00:00:00.000Z", value: data.now[dataName] }
          ],
          now: {
            count: 2,
            cpu: 2736,
            gpu: 2742,
            memory: 2748,
            storage: 5514
          },
          compare: {
            count: 2,
            cpu: 2136,
            gpu: 2142,
            memory: 2148,
            storage: 4314
          }
        });
      });
    });

    it("returns 404 for an invalid data name", async () => {
      const response = await app.request("/v1/provider-graph-data/foo");

      expect(response.status).toBe(404);
    });

    it("drops data from first 15 minutes of the day", async () => {
      const today = new Date();
      today.setHours(0, 14, 59, 999);

      await ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: today,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 1000,
        activeGPU: 1000,
        activeMemory: 1000,
        activePersistentStorage: 1000,
        activeEphemeralStorage: 1000,
        pendingCPU: 1000,
        pendingGPU: 1000,
        pendingMemory: 1000,
        pendingPersistentStorage: 1000,
        pendingEphemeralStorage: 1000,
        availableCPU: 1000,
        availableGPU: 1000,
        availableMemory: 1000,
        availablePersistentStorage: 1000,
        availableEphemeralStorage: 1000
      });

      await DaySeeder.createInDatabase({
        date: format(today, "yyyy-MM-dd"),
        firstBlockHeight: 301,
        lastBlockHeight: 400,
        lastBlockHeightYet: 400
      });

      await BlockSeeder.createInDatabase({
        datetime: today,
        height: 400
      });

      const response = await app.request("/v1/provider-graph-data/count");
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);

      expect(data.snapshots[data.snapshots.length - 1].date).toBe(format(yesterday, "yyyy-MM-dd") + "T00:00:00.000Z");
    });
  });
});
