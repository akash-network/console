import "@src/providers";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { AUDITOR } from "@src/repositories/bid-screening/bid-screening.repository";
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

    it("leaves out a provider whose signed region differs from the one it declares", async () => {
      await seed({
        owner: "akash1stale",
        selfAttributes: [{ key: "location-region", value: "eu-west" }],
        signedAttributes: [{ key: "location-region", value: "na-us-east", auditor: AUDITOR }]
      });

      expect(await repository.findOnlineRegions()).toEqual([]);
    });

    it("leaves out a region only another auditor signed", async () => {
      await seed({
        owner: "akash1otherAuditor",
        auditedBy: [AUDITOR, "akash1otherauditor"],
        selfAttributes: [{ key: "location-region", value: "eu-west" }],
        signedAttributes: [{ key: "location-region", value: "eu-west", auditor: "akash1otherauditor" }]
      });

      expect(await repository.findOnlineRegions()).toEqual([]);
    });

    it("leaves out providers the Console auditor has not audited", async () => {
      await seed({ owner: "akash1audited", region: "eu-west" });
      await seed({ owner: "akash1unaudited", region: "eu-west", auditedBy: [] });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "eu-west", providerCount: 1 }]);
    });

    it("leaves out providers that advertise no region", async () => {
      await seed({ owner: "akash1regionless", selfAttributes: [{ key: "organization", value: "akash" }] });
      await seed({ owner: "akash1placed", region: "eu-west" });

      expect(await repository.findOnlineRegions()).toEqual([{ region: "eu-west", providerCount: 1 }]);
    });
  });

  describe("findAvailableGpus", () => {
    it("returns every kind of gpu on a node with free capacity, with its device count and the gpus the node has free", async () => {
      await seed({
        owner: "akash1gpu",
        maxNodeFreeGpu: 4n,
        nodes: [
          node({
            allocatable: 8,
            allocated: 4,
            info: [gpuInfo({ name: "a100", memorySize: "40Gi" }), gpuInfo({ name: "h100", memorySize: "80Gi" }), gpuInfo({ name: "a100", memorySize: "40Gi" })]
          })
        ]
      });

      expect(await repository.findAvailableGpus()).toEqual([
        { owner: "akash1gpu", node: 1, vendor: "nvidia", model: "a100", memory: "40Gi", interface: "pcie", units: 2, nodeFreeUnits: 4, advertisedGpuKeys: [] },
        { owner: "akash1gpu", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "pcie", units: 1, nodeFreeUnits: 4, advertisedGpuKeys: [] }
      ]);
    });

    it("reports each node of each provider on its own", async () => {
      await seed({
        owner: "akash1first",
        maxNodeFreeGpu: 4n,
        nodes: [
          node({ allocatable: 8, allocated: 6, info: [gpuInfo({ name: "a100" })] }),
          node({ allocatable: 8, allocated: 4, info: [gpuInfo({ name: "a100" })] })
        ]
      });
      await seed({ owner: "akash1second", maxNodeFreeGpu: 8n, nodes: [node({ info: [gpuInfo({ name: "a100" })] })] });

      expect((await repository.findAvailableGpus()).map(gpu => [gpu.owner, gpu.node, gpu.nodeFreeUnits])).toEqual([
        ["akash1first", 1, 2],
        ["akash1first", 2, 4],
        ["akash1second", 1, 8]
      ]);
    });

    it("treats a node reporting no allocation as having every gpu free", async () => {
      await seed({ owner: "akash1unreported", maxNodeFreeGpu: 4n, nodes: [node({ allocatable: 4, allocated: null, info: [gpuInfo({ name: "a100" })] })] });

      expect((await repository.findAvailableGpus()).map(gpu => gpu.nodeFreeUnits)).toEqual([4]);
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

      expect((await repository.findAvailableGpus()).map(gpu => [gpu.model, gpu.nodeFreeUnits])).toEqual([["a100", null]]);
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

      expect(await repository.findAvailableGpus()).toEqual([
        { owner: "akash1blank", node: 1, vendor: "nvidia", model: "a100", memory: "", interface: "", units: 1, nodeFreeUnits: 8, advertisedGpuKeys: [] }
      ]);
    });

    it("returns the gpu keys the provider advertises as true, without their capability prefix", async () => {
      await seed({
        owner: "akash1advertiser",
        maxNodeFreeGpu: 4n,
        selfAttributes: [
          { key: "capabilities/gpu/vendor/nvidia/model/h100/ram/80Gi", value: "true" },
          { key: "capabilities/gpu/vendor/nvidia/model/h100", value: "true" },
          { key: "capabilities/gpu/vendor/nvidia/model/a100", value: "false" },
          { key: "capabilities/storage/1/class", value: "beta3" },
          { key: "location-region", value: "eu-west" }
        ],
        nodes: [node({ info: [gpuInfo({ name: "h100" })] })]
      });

      expect((await repository.findAvailableGpus()).map(gpu => gpu.advertisedGpuKeys)).toEqual([
        ["vendor/nvidia/model/h100", "vendor/nvidia/model/h100/ram/80Gi"]
      ]);
    });

    it("leaves out gpus of a provider the Console auditor has not audited", async () => {
      await seed({ owner: "akash1unaudited", auditedBy: [], maxNodeFreeGpu: 4n, nodes: [node({ info: [gpuInfo({ name: "a100" })] })] });

      expect(await repository.findAvailableGpus()).toEqual([]);
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

  function node(input: { allocatable?: number; allocated?: number | null; info?: GpuInfo[] }): NodeState {
    const quantity =
      input.allocated === null ? { allocatable: input.allocatable ?? 8 } : { allocatable: input.allocatable ?? 8, allocated: input.allocated ?? 0 };

    return {
      name: "node-1",
      cpu: { allocatable: 1000, allocated: 0 },
      memory: { allocatable: 1000, allocated: 0 },
      ephemeralStorage: { allocatable: 1000, allocated: 0 },
      gpu: { quantity: quantity as NodeState["gpu"]["quantity"], info: input.info ?? [] },
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
    signedAttributes?: Array<{ key: string; value: string; auditor: string }>;
    auditedBy?: string[];
    maxNodeFreeGpu?: bigint;
    nodes?: NodeState[];
  }): Promise<void> {
    const inventory: ClusterState = { nodes: input.nodes ?? [], storage: {} };
    const regionAttributes = input.region ? [{ key: "location-region", value: input.region }] : [];

    await db.insert(providerInventory).values({
      owner: input.owner,
      hostUri: `https://${input.owner}:8443`,
      isOnline: input.isOnline ?? true,
      isOnlineSince: input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
      maxNodeFreeGpu: input.maxNodeFreeGpu ?? 0n,
      selfAttributes: input.selfAttributes ?? regionAttributes,
      signedAttributes: input.signedAttributes ?? regionAttributes.map(attribute => ({ ...attribute, auditor: AUDITOR })),
      auditedBy: input.auditedBy ?? [AUDITOR],
      inventory
    });
  }
});
