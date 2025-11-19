import type { Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { format, subDays } from "date-fns";
import { container } from "tsyringe";

import { app, initDb } from "@src/rest-app";
import { AuthorizedGraphDataNames } from "@src/services/db/statsService";

import { createAkashBlock, createDay, createProvider, createProviderSnapshot, createProviderSnapshotNode, createProviderSnapshotNodeGpu } from "@test/seeders";

describe("Graph Data", () => {
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
      createDay({
        date: format(threeDaysAgo, "yyyy-MM-dd"),
        firstBlockHeight: 1,
        lastBlockHeight: 100,
        lastBlockHeightYet: 100
      }),
      createDay({
        date: format(twoDaysAgo, "yyyy-MM-dd"),
        firstBlockHeight: 101,
        lastBlockHeight: 200,
        lastBlockHeightYet: 200
      }),
      createDay({
        date: format(yesterday, "yyyy-MM-dd"),
        firstBlockHeight: 201,
        lastBlockHeight: 300,
        lastBlockHeightYet: 300
      })
    ]);

    providers = await Promise.all([createProvider(), createProvider()]);
    providerSnapshots = await Promise.all([
      createProviderSnapshot({
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
      createProviderSnapshot({
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
      createProviderSnapshot({
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
      })
    ]);

    const providerSnapshotNodes = await Promise.all([
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[0].id,
        name: "GPU 1",
        gpuAllocatable: 100,
        gpuAllocated: 50
      }),
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[1].id,
        name: "GPU 1",
        gpuAllocatable: 100,
        gpuAllocated: 50
      }),
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[2].id,
        name: "GPU 1",
        gpuAllocatable: 100,
        gpuAllocated: 50
      })
    ]);

    await Promise.all([
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[0].id,
        name: "GPU 1"
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[1].id,
        name: "GPU 1"
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[2].id,
        name: "GPU 1"
      })
    ]);

    await Promise.all([
      providers[0].update({
        lastSuccessfulSnapshotId: providerSnapshots[2].id
      })
    ]);

    await Promise.all([
      createAkashBlock({
        datetime: threeDaysAgo,
        height: 100
      }),
      createAkashBlock({
        datetime: twoDaysAgo,
        height: 200
      }),
      createAkashBlock({
        datetime: yesterday,
        height: 300,
        isProcessed: true
      })
    ]);
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/graph-data/{dataName}", () => {
    AuthorizedGraphDataNames.forEach(dataName => {
      it(`returns graph data for ${dataName}`, async () => {
        const response = await app.request(`/v1/graph-data/${dataName}`);

        const data = (await response.json()) as any;

        expect(response.status).toBe(200);

        expect(data).toEqual({
          currentValue: expect.any(Number),
          compareValue: expect.any(Number),
          snapshots: [
            { date: format(threeDaysAgo, "yyyy-MM-dd") + "T00:00:00.000Z", value: expect.any(Number) },
            { date: format(twoDaysAgo, "yyyy-MM-dd") + "T00:00:00.000Z", value: data.compareValue },
            { date: format(yesterday, "yyyy-MM-dd") + "T00:00:00.000Z", value: data.currentValue }
          ]
        });
      });
    });

    it("returns 404 for an invalid data name", async () => {
      const response = await app.request("/v1/graph-data/foo");

      expect(response.status).toBe(404);
    });
  });
});
