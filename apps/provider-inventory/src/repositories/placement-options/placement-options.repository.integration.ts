import "@src/providers";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { ClusterState, GpuInfo, NodeState } from "@src/types/inventory";
import { PlacementOptionsRepository } from "./placement-options.repository";

describe(PlacementOptionsRepository.name, () => {
  let repository: PlacementOptionsRepository;
  let db: PostgresJsDatabase;

  beforeEach(() => {
    repository = container.resolve(PlacementOptionsRepository);
    db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
  });

  describe("findOnlineRegions", () => {
    it("counts the online providers advertising each region, sorted by region", async () => {
      await seed({ owner: "akash1a", region: "eu-west" });
      await seed({ owner: "akash1b", region: "eu-west" });
      await seed({ owner: "akash1c", region: "as-east" });

      expect(await repository.findOnlineRegions()).toEqual([
        { region: "as-east", providerCount: 1 },
        { region: "eu-west", providerCount: 2 }
      ]);
    });

    it("leaves out regions whose only providers are offline", async () => {
      await seed({ owner: "akash1online", region: "eu-west" });
      await seed({ owner: "akash1offline", region: "sa-brazil", isOnline: false });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "eu-west", providerCount: 1 }]);
    });

    it("counts only the providers of a region that are online", async () => {
      await seed({ owner: "akash1online", region: "eu-west" });
      await seed({ owner: "akash1offline", region: "eu-west", isOnline: false });
      await seed({ owner: "akash1neverUp", region: "eu-west", isOnlineSince: null });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "eu-west", providerCount: 1 }]);
    });

    it("leaves out a provider marked online that never came up", async () => {
      await seed({ owner: "akash1neverUp", region: "oc-aus", isOnlineSince: null });

      expect(await repository.findOnlineRegions()).toEqual([]);
    });

    it("prefers the signed region over the self-declared one", async () => {
      await seed({
        owner: "akash1audited",
        selfAttributes: [{ key: "location-region", value: "eu-west" }],
        signedAttributes: [{ key: "location-region", value: "na-us-east" }]
      });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "na-us-east", providerCount: 1 }]);
    });

    it("leaves out providers that advertise no region", async () => {
      await seed({ owner: "akash1regionless", selfAttributes: [{ key: "organization", value: "akash" }] });
      await seed({ owner: "akash1placed", region: "eu-west" });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "eu-west", providerCount: 1 }]);
    });
  });

  describe("findAvailableGpus", () => {
    it("returns every distinct gpu on a node with free capacity", async () => {
      await seed({
        owner: "akash1gpu",
        maxNodeFreeGpu: 4n,
        nodes: [node({ allocatable: 8, allocated: 4, info: [gpuInfo({ name: "a100", memorySize: "40Gi" }), gpuInfo({ name: "h100", memorySize: "80Gi" })] })]
      });

      expect(await repository.findAvailableGpus()).toEqual([
        { owner: "akash1gpu", vendor: "nvidia", model: "a100", memory: "40Gi", interface: "pcie" },
        { owner: "akash1gpu", vendor: "nvidia", model: "h100", memory: "80Gi", interface: "pcie" }
      ]);
    });

    it("reports a gpu once for each provider offering it", async () => {
      await seed({
        owner: "akash1first",
        maxNodeFreeGpu: 4n,
        nodes: [node({ info: [gpuInfo({ name: "a100" })] }), node({ info: [gpuInfo({ name: "a100" })] })]
      });
      await seed({ owner: "akash1second", maxNodeFreeGpu: 4n, nodes: [node({ info: [gpuInfo({ name: "a100" })] })] });

      expect(await repository.findAvailableGpus()).toEqual([
        { owner: "akash1first", vendor: "nvidia", model: "a100", memory: "40Gi", interface: "pcie" },
        { owner: "akash1second", vendor: "nvidia", model: "a100", memory: "40Gi", interface: "pcie" }
      ]);
    });

    it("leaves out gpus on a fully leased node", async () => {
      await seed({
        owner: "akash1full",
        maxNodeFreeGpu: 2n,
        nodes: [
          node({ allocatable: 8, allocated: 8, info: [gpuInfo({ name: "leased" })] }),
          node({ allocatable: 4, allocated: 2, info: [gpuInfo({ name: "free" })] })
        ]
      });

      expect((await repository.findAvailableGpus()).map(gpu => gpu.model)).toEqual(["free"]);
    });

    it("treats a node reporting unlimited capacity as free", async () => {
      await seed({ owner: "akash1unlimited", maxNodeFreeGpu: 1n, nodes: [node({ allocatable: -1, allocated: 12, info: [gpuInfo({ name: "a100" })] })] });

      expect((await repository.findAvailableGpus()).map(gpu => gpu.model)).toEqual(["a100"]);
    });

    it("leaves out gpus of an offline provider", async () => {
      await seed({ owner: "akash1offline", isOnline: false, maxNodeFreeGpu: 4n, nodes: [node({ info: [gpuInfo({ name: "a100" })] })] });

      expect(await repository.findAvailableGpus()).toEqual([]);
    });

    it("leaves out a provider whose every node is out of gpu capacity", async () => {
      await seed({ owner: "akash1noFreeGpu", maxNodeFreeGpu: 0n, nodes: [node({ allocatable: 8, allocated: 8, info: [gpuInfo({ name: "a100" })] })] });

      expect(await repository.findAvailableGpus()).toEqual([]);
    });

    it("leaves out gpu entries missing a vendor or a model", async () => {
      await seed({
        owner: "akash1partial",
        maxNodeFreeGpu: 4n,
        nodes: [node({ info: [gpuInfo({ vendor: "", name: "a100" }), gpuInfo({ name: "" }), gpuInfo({ name: "h100" })] })]
      });

      expect((await repository.findAvailableGpus()).map(gpu => gpu.model)).toEqual(["h100"]);
    });

    it("returns nothing for a provider with no nodes", async () => {
      await seed({ owner: "akash1empty", maxNodeFreeGpu: 4n });

      expect(await repository.findAvailableGpus()).toEqual([]);
    });

    it("reports a memory size or interface the provider left blank as blank", async () => {
      await seed({ owner: "akash1blank", maxNodeFreeGpu: 4n, nodes: [node({ info: [gpuInfo({ name: "a100", memorySize: "", interface: "" })] })] });

      expect(await repository.findAvailableGpus()).toEqual([{ owner: "akash1blank", vendor: "nvidia", model: "a100", memory: "", interface: "" }]);
    });
  });

  function gpuInfo(input: Partial<GpuInfo>): GpuInfo {
    return {
      vendor: input.vendor ?? "nvidia",
      name: input.name ?? "a100",
      modelId: input.modelId ?? "0x20b0",
      interface: input.interface ?? "pcie",
      memorySize: input.memorySize ?? "40Gi"
    };
  }

  function node(input: { allocatable?: number; allocated?: number; info?: GpuInfo[] }): NodeState {
    return {
      name: "node-1",
      cpu: { allocatable: 1000, allocated: 0 },
      memory: { allocatable: 1000, allocated: 0 },
      ephemeralStorage: { allocatable: 1000, allocated: 0 },
      gpu: { quantity: { allocatable: input.allocatable ?? 8, allocated: input.allocated ?? 0 }, info: input.info ?? [] },
      storageClasses: [],
      cpus: []
    };
  }

  async function seed(input: {
    owner: string;
    isOnline?: boolean;
    isOnlineSince?: Date | null;
    region?: string;
    selfAttributes?: Array<{ key: string; value: string }>;
    signedAttributes?: Array<{ key: string; value: string }>;
    maxNodeFreeGpu?: bigint;
    nodes?: NodeState[];
  }): Promise<void> {
    const inventory: ClusterState = { nodes: input.nodes ?? [], storage: {} };

    await db.insert(providerInventory).values({
      owner: input.owner,
      hostUri: `https://${input.owner}:8443`,
      isOnline: input.isOnline ?? true,
      isOnlineSince: input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
      maxNodeFreeGpu: input.maxNodeFreeGpu ?? 0n,
      selfAttributes: input.selfAttributes ?? (input.region ? [{ key: "location-region", value: input.region }] : []),
      signedAttributes: input.signedAttributes ?? [],
      inventory
    });
  }
});
