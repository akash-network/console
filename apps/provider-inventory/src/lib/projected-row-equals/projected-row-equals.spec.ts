import { describe, expect, it } from "vitest";

import type { Inventory, InventoryClusterStorage, InventoryNode, InventoryRollups, ProjectedRow } from "@src/types/inventory";
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
        storage: [{ class: "beta2", available: 100 }]
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
        storage: [{ class: "beta2", available: 100 }]
      });

      expect(projectedRowsEqual(a, b)).toBe(true);
    });
  });

  describe("single-field differs per rollup column", () => {
    it.each([
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
    ] as const)("returns false when %s differs", (_field, override) => {
      const a = buildRow();
      const b = buildRow(override);
      expect(projectedRowsEqual(a, b)).toBe(false);
    });
  });

  describe("JSONB-nested differs", () => {
    it("returns false when a node's cpu.available differs", () => {
      const a = buildRow({ nodes: [buildNode({ cpu: { available: 1000 } })] });
      const b = buildRow({ nodes: [buildNode({ cpu: { available: 2000 } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's memory.available differs", () => {
      const a = buildRow({ nodes: [buildNode({ memory: { available: 1000 } })] });
      const b = buildRow({ nodes: [buildNode({ memory: { available: 2000 } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's ephStorage.available differs", () => {
      const a = buildRow({ nodes: [buildNode({ ephStorage: { available: 1000 } })] });
      const b = buildRow({ nodes: [buildNode({ ephStorage: { available: 2000 } })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's name differs", () => {
      const a = buildRow({ nodes: [buildNode({ name: "node-1" })] });
      const b = buildRow({ nodes: [buildNode({ name: "node-2" })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's gpu available count differs", () => {
      const a = buildRow({ nodes: [buildNode({ gpu: [{ vendor: "nvidia", model: "a100", available: 1 }] })] });
      const b = buildRow({ nodes: [buildNode({ gpu: [{ vendor: "nvidia", model: "a100", available: 2 }] })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's gpu vendor/model differs", () => {
      const a = buildRow({ nodes: [buildNode({ gpu: [{ vendor: "nvidia", model: "a100", available: 1 }] })] });
      const b = buildRow({ nodes: [buildNode({ gpu: [{ vendor: "amd", model: "mi300x", available: 1 }] })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's persistentStorage class differs", () => {
      const a = buildRow({ nodes: [buildNode({ persistentStorage: [{ class: "beta2", available: 100 }] })] });
      const b = buildRow({ nodes: [buildNode({ persistentStorage: [{ class: "beta3", available: 100 }] })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when a node's persistentStorage available differs", () => {
      const a = buildRow({ nodes: [buildNode({ persistentStorage: [{ class: "beta2", available: 100 }] })] });
      const b = buildRow({ nodes: [buildNode({ persistentStorage: [{ class: "beta2", available: 200 }] })] });
      expect(projectedRowsEqual(a, b)).toBe(false);
    });

    it("returns false when cluster-level storage available differs", () => {
      const a = buildRow({ storage: [{ class: "beta2", available: 100 }] });
      const b = buildRow({ storage: [{ class: "beta2", available: 200 }] });
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

    it("ignores order of gpus within a node", () => {
      const a = buildRow({
        nodes: [
          buildNode({
            gpu: [
              { vendor: "nvidia", model: "a100", available: 1 },
              { vendor: "amd", model: "mi300x", available: 2 }
            ]
          })
        ]
      });
      const b = buildRow({
        nodes: [
          buildNode({
            gpu: [
              { vendor: "amd", model: "mi300x", available: 2 },
              { vendor: "nvidia", model: "a100", available: 1 }
            ]
          })
        ]
      });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });

    it("ignores order of persistentStorage within a node", () => {
      const a = buildRow({
        nodes: [
          buildNode({
            persistentStorage: [
              { class: "beta2", available: 100 },
              { class: "beta3", available: 200 }
            ]
          })
        ]
      });
      const b = buildRow({
        nodes: [
          buildNode({
            persistentStorage: [
              { class: "beta3", available: 200 },
              { class: "beta2", available: 100 }
            ]
          })
        ]
      });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });

    it("ignores order of cluster-level storage", () => {
      const a = buildRow({
        storage: [
          { class: "beta2", available: 100 },
          { class: "beta3", available: 200 }
        ]
      });
      const b = buildRow({
        storage: [
          { class: "beta3", available: 200 },
          { class: "beta2", available: 100 }
        ]
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

    it("ignores order across all reorderable arrays simultaneously", () => {
      const a = buildRow({
        gpuModels: ["amd/mi300x", "nvidia/a100"],
        storageClasses: ["beta2", "beta3"],
        nodes: [
          buildNode({
            name: "node-1",
            gpu: [
              { vendor: "nvidia", model: "a100", available: 1 },
              { vendor: "amd", model: "mi300x", available: 1 }
            ],
            persistentStorage: [
              { class: "beta2", available: 100 },
              { class: "beta3", available: 200 }
            ]
          }),
          buildNode({ name: "node-2" })
        ],
        storage: [
          { class: "beta2", available: 100 },
          { class: "beta3", available: 200 }
        ]
      });
      const b = buildRow({
        gpuModels: ["nvidia/a100", "amd/mi300x"],
        storageClasses: ["beta3", "beta2"],
        nodes: [
          buildNode({ name: "node-2" }),
          buildNode({
            name: "node-1",
            gpu: [
              { vendor: "amd", model: "mi300x", available: 1 },
              { vendor: "nvidia", model: "a100", available: 1 }
            ],
            persistentStorage: [
              { class: "beta3", available: 200 },
              { class: "beta2", available: 100 }
            ]
          })
        ],
        storage: [
          { class: "beta3", available: 200 },
          { class: "beta2", available: 100 }
        ]
      });
      expect(projectedRowsEqual(a, b)).toBe(true);
    });
  });
});

function buildRow(overrides: Partial<InventoryRollups> & { nodes?: InventoryNode[]; storage?: InventoryClusterStorage[] } = {}): ProjectedRow {
  const { nodes, storage, ...rollupOverrides } = overrides;
  const inventory: Inventory = {
    nodes: nodes ?? [],
    storage: storage ?? []
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
    inventory
  };
}

function buildNode(overrides?: Partial<InventoryNode>): InventoryNode {
  return {
    name: "node-1",
    cpu: { available: 0 },
    memory: { available: 0 },
    gpu: [],
    ephStorage: { available: 0 },
    persistentStorage: [],
    ...overrides
  };
}
