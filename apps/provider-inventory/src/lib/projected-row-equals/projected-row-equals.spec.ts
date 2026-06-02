import { describe, expect, it } from "vitest";

import type { InventoryRollups, ProjectedRow } from "@src/types/inventory";
import type { ClusterState, GpuInfo, NodeState } from "@src/types/inventory.types";
import { projectedRowsEqual } from "./projected-row-equals";

describe(projectedRowsEqual.name, () => {
  describe("empty state", () => {
    it("considers two empty rows equal", () => {
      expect(projectedRowsEqual(buildRow(), buildRow())).toBe(true);
    });

    it("considers a row equal to itself", () => {
      const row = buildRow();
      expect(projectedRowsEqual(row, row)).toBe(true);
    });
  });

  describe("all fields equal", () => {
    it("considers two structurally identical fully-populated rows equal", () => {
      const a = buildRow({
        totalAvailableCpu: 12_000n,
        totalAvailableMemory: 48_000_000_000n,
        totalAvailableGpu: 4n,
        totalAvailableEph: 500_000_000_000n,
        totalAvailablePersistent: 1_000_000_000_000n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 32_000_000_000n,
        maxNodeFreeGpu: 4n,
        gpuModels: ["nvidia/a100"],
        storageClasses: ["beta2", "beta3"],
        nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })],
        storage: storageMap([{ class: "beta2", allocatable: 100n }])
      });
      const b = buildRow({
        totalAvailableCpu: 12_000n,
        totalAvailableMemory: 48_000_000_000n,
        totalAvailableGpu: 4n,
        totalAvailableEph: 500_000_000_000n,
        totalAvailablePersistent: 1_000_000_000_000n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 32_000_000_000n,
        maxNodeFreeGpu: 4n,
        gpuModels: ["nvidia/a100"],
        storageClasses: ["beta2", "beta3"],
        nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })],
        storage: storageMap([{ class: "beta2", allocatable: 100n }])
      });

      expect(projectedRowsEqual(a, b)).toBe(true);
    });
  });

  describe("single-field differs per rollup column", () => {
    it.each<[string, Partial<InventoryRollups>]>([
      ["totalAvailableCpu", { totalAvailableCpu: 999n }],
      ["totalAvailableMemory", { totalAvailableMemory: 999n }],
      ["totalAvailableGpu", { totalAvailableGpu: 999n }],
      ["totalAvailableEph", { totalAvailableEph: 999n }],
      ["totalAvailablePersistent", { totalAvailablePersistent: 999n }],
      ["maxNodeFreeCpu", { maxNodeFreeCpu: 999n }],
      ["maxNodeFreeMemory", { maxNodeFreeMemory: 999n }],
      ["maxNodeFreeGpu", { maxNodeFreeGpu: 999n }],
      ["gpuModels", { gpuModels: ["nvidia/h100"] }],
      ["storageClasses", { storageClasses: ["beta3"] }]
    ])("returns false when %s differs", (_field, override) => {
      const a = buildRow();
      const b = buildRow(override);
      expect(projectedRowsEqual(a, b)).toBe(false);
    });
  });

  describe("ClusterState-nested differs", () => {
    it("returns false when a node's cpu allocatable differs", () => {
      const a = buildRow({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildRow({ nodes: [buildNode({ cpu: { allocatable: 2000n, allocated: 0n } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's cpu allocated differs", () => {
      const a = buildRow({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildRow({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 500n } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's memory differs", () => {
      const a = buildRow({ nodes: [buildNode({ memory: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildRow({ nodes: [buildNode({ memory: { allocatable: 2000n, allocated: 0n } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's ephemeralStorage differs", () => {
      const a = buildRow({ nodes: [buildNode({ ephemeralStorage: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildRow({ nodes: [buildNode({ ephemeralStorage: { allocatable: 2000n, allocated: 0n } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's name differs", () => {
      const a = buildRow({ nodes: [buildNode({ name: "node-1" })] });
      const b = buildRow({ nodes: [buildNode({ name: "node-2" })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's gpu quantity differs", () => {
      const a = buildRow({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      const b = buildRow({ nodes: [buildNode({ gpu: { quantity: { allocatable: 2n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's gpu info differs", () => {
      const a = buildRow({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      const b = buildRow({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("amd", "mi300x")] } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's storageClasses differ", () => {
      const a = buildRow({ nodes: [buildNode({ storageClasses: ["beta2"] })] });
      const b = buildRow({ nodes: [buildNode({ storageClasses: ["beta3"] })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when cluster-level storage class differs", () => {
      const a = buildRow({ storage: storageMap([{ class: "beta2", allocatable: 100n }]) });
      const b = buildRow({ storage: storageMap([{ class: "beta3", allocatable: 100n }]) });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when cluster-level storage quantity differs", () => {
      const a = buildRow({ storage: storageMap([{ class: "beta2", allocatable: 100n }]) });
      const b = buildRow({ storage: storageMap([{ class: "beta2", allocatable: 200n }]) });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when node count differs", () => {
      const a = buildRow({ nodes: [buildNode({ name: "node-1" })] });
      const b = buildRow({ nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });
  });

  describe("order-insensitive comparison", () => {
    it("ignores order of nodes", () => {
      const a = buildRow({ nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })] });
      const b = buildRow({ nodes: [buildNode({ name: "node-2" }), buildNode({ name: "node-1" })] });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });

    it("ignores order of gpu info within a node", () => {
      const a = buildRow({
        nodes: [buildNode({ gpu: { quantity: { allocatable: 3n, allocated: 0n }, info: [gpu("nvidia", "a100"), gpu("amd", "mi300x")] } })]
      });
      const b = buildRow({
        nodes: [buildNode({ gpu: { quantity: { allocatable: 3n, allocated: 0n }, info: [gpu("amd", "mi300x"), gpu("nvidia", "a100")] } })]
      });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });

    it("ignores order of gpuModels", () => {
      const a = buildRow({ gpuModels: ["amd/mi300x", "nvidia/a100"] });
      const b = buildRow({ gpuModels: ["nvidia/a100", "amd/mi300x"] });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });

    it("ignores order of storageClasses", () => {
      const a = buildRow({ storageClasses: ["beta2", "beta3"] });
      const b = buildRow({ storageClasses: ["beta3", "beta2"] });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });
  });
});

function gpu(vendor: string, name: string): GpuInfo {
  return { vendor, name, modelId: "", interface: "", memorySize: "" };
}

function storageMap(pools: { class: string; allocatable: bigint; allocated?: bigint }[]): ClusterState["storage"] {
  const result: NonNullable<ClusterState["storage"]> = Object.create(null);
  for (const pool of pools) {
    result[pool.class] = { class: pool.class, quantity: { allocatable: pool.allocatable, allocated: pool.allocated ?? 0n } };
  }
  return result;
}

function buildRow(overrides: Partial<InventoryRollups> & { nodes?: NodeState[]; storage?: ClusterState["storage"] } = {}): ProjectedRow {
  const { nodes, storage, ...rollupOverrides } = overrides;
  const cluster: ClusterState = {
    nodes: nodes ?? [],
    storage: storage ?? Object.create(null)
  };
  return {
    totalAvailableCpu: 0n,
    totalAvailableMemory: 0n,
    totalAvailableGpu: 0n,
    totalAvailableEph: 0n,
    totalAvailablePersistent: 0n,
    maxNodeFreeCpu: 0n,
    maxNodeFreeMemory: 0n,
    maxNodeFreeGpu: 0n,
    gpuModels: [],
    storageClasses: [],
    ...rollupOverrides,
    cluster
  };
}

function buildNode(overrides?: Partial<NodeState>): NodeState {
  return {
    name: "node-1",
    cpu: { allocatable: 0n, allocated: 0n },
    memory: { allocatable: 0n, allocated: 0n },
    ephemeralStorage: { allocatable: 0n, allocated: 0n },
    gpu: { quantity: { allocatable: 0n, allocated: 0n }, info: [] },
    storageClasses: [],
    cpus: [],
    ...overrides
  };
}
