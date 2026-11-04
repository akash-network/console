import { Provider, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { TrialGpuAvailability } from "@src/gpu/http-schemas/gpu.schema";
import { app, initDb } from "@src/rest-app";

import {
  createAkashAddress,
  createProvider,
  createProviderSeed,
  createProviderSnapshot,
  createProviderSnapshotNode,
  createProviderSnapshotNodeGpu
} from "@test/seeders";

describe("Trial GPU availability API", () => {
  let isDbInitialized = false;

  describe("GET /v1/trial-gpu-availability", () => {
    it("returns the free units of each trial-allowed gpu model on audited providers only", async () => {
      await setup();

      const response = await app.request("/v1/trial-gpu-availability");

      expect(response.status).toBe(200);
      expect((await response.json()) as { data: TrialGpuAvailability[] }).toEqual({
        data: [
          { vendor: "nvidia", model: "v100", freeUnits: 5 },
          { vendor: "nvidia", model: "p4", freeUnits: 2 }
        ]
      });
    });

    it("lets clients and the cdn cache the answer for a minute", async () => {
      await setup();

      const response = await app.request("/v1/trial-gpu-availability");

      expect(response.headers.get("Cache-Control")).toContain("max-age=60");
    });
  });

  async function setup() {
    if (isDbInitialized) return;

    await initDb();

    const auditedProviders = await Promise.all([createProvider({ isOnline: true }), createProvider({ isOnline: true })]);
    const unauditedProvider = await Provider.create(createProviderSeed({ isOnline: true }));
    await ProviderAttributeSignature.create({ provider: unauditedProvider.owner, auditor: createAkashAddress(), key: "region", value: "us-west" });

    await seedGpuNodes(auditedProviders[0], [
      { name: "v100", allocatable: 4, allocated: 1 },
      { name: "h100", allocatable: 8, allocated: 0 },
      { name: "t4", allocatable: 1, allocated: 1 }
    ]);
    await seedGpuNodes(auditedProviders[1], [
      { name: "v100", allocatable: 2, allocated: 0 },
      { name: "p4", allocatable: 2, allocated: 0 }
    ]);
    await seedGpuNodes(unauditedProvider, [
      { name: "v100", allocatable: 8, allocated: 0 },
      { name: "a10", allocatable: 4, allocated: 0 }
    ]);

    isDbInitialized = true;
  }

  async function seedGpuNodes(provider: Provider, gpus: { name: string; allocatable: number; allocated: number }[]) {
    const snapshot = await createProviderSnapshot({ owner: provider.owner, checkDate: new Date(), isOnline: true });
    await provider.update({ lastSuccessfulSnapshotId: snapshot.id });

    for (const gpu of gpus) {
      const node = await createProviderSnapshotNode({
        snapshotId: snapshot.id,
        name: faker.string.alphanumeric(8),
        gpuAllocatable: gpu.allocatable,
        gpuAllocated: gpu.allocated
      });
      await createProviderSnapshotNodeGpu({
        snapshotNodeId: node.id,
        vendor: "nvidia",
        name: gpu.name,
        modelId: faker.string.alpha(10),
        interface: "pcie",
        memorySize: 16384
      });
    }
  }
});
