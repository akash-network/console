import { describe, expect, it } from "vitest";

import type { Inventory } from "@src/types/inventory";
import { computeRollups } from "./compute-rollups";

describe(computeRollups.name, () => {
  it("returns all zeros for an empty cluster", () => {
    const result = setup({ nodes: [], storage: [] });

    expect(result).toEqual({
      totalAvailableCpu: 0n,
      totalAvailableMemory: 0n,
      totalAvailableGpu: 0n,
      totalAvailableEph: 0n,
      totalAvailablePersistent: 0n,
      maxNodeFreeCpu: 0n,
      maxNodeFreeMemory: 0n,
      maxNodeFreeGpu: 0n,
      gpuModels: [],
      storageClasses: []
    });
  });

  it("computes rollups for a single node", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 4000 },
          memory: { available: 8_000_000_000 },
          gpu: [{ vendor: "nvidia", model: "a100", available: 2 }],
          eph_storage: { available: 100_000_000_000 },
          persistent_storage: [{ class: "beta2", available: 500_000_000_000 }]
        }
      ],
      storage: []
    });

    expect(result.totalAvailableCpu).toBe(4000n);
    expect(result.totalAvailableMemory).toBe(8_000_000_000n);
    expect(result.totalAvailableGpu).toBe(2n);
    expect(result.totalAvailableEph).toBe(100_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(500_000_000_000n);
    expect(result.maxNodeFreeCpu).toBe(4000n);
    expect(result.maxNodeFreeMemory).toBe(8_000_000_000n);
    expect(result.maxNodeFreeGpu).toBe(2n);
    expect(result.gpuModels).toEqual(["nvidia/a100"]);
    expect(result.storageClasses).toEqual(["beta2"]);
  });

  it("sums totals across multiple nodes and tracks max-per-node", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 2000 },
          memory: { available: 4_000_000_000 },
          gpu: [{ vendor: "nvidia", model: "a100", available: 1 }],
          eph_storage: { available: 50_000_000_000 },
          persistent_storage: []
        },
        {
          name: "node-2",
          cpu: { available: 8000 },
          memory: { available: 16_000_000_000 },
          gpu: [{ vendor: "nvidia", model: "a100", available: 4 }],
          eph_storage: { available: 200_000_000_000 },
          persistent_storage: [{ class: "beta2", available: 1_000_000_000_000 }]
        }
      ],
      storage: []
    });

    expect(result.totalAvailableCpu).toBe(10_000n);
    expect(result.totalAvailableMemory).toBe(20_000_000_000n);
    expect(result.totalAvailableGpu).toBe(5n);
    expect(result.totalAvailableEph).toBe(250_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(1_000_000_000_000n);
    expect(result.maxNodeFreeCpu).toBe(8000n);
    expect(result.maxNodeFreeMemory).toBe(16_000_000_000n);
    expect(result.maxNodeFreeGpu).toBe(4n);
  });

  it("deduplicates GPU models across nodes", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000 },
          memory: { available: 1000 },
          gpu: [
            { vendor: "nvidia", model: "a100", available: 1 },
            { vendor: "amd", model: "mi300x", available: 1 }
          ],
          eph_storage: { available: 0 },
          persistent_storage: []
        },
        {
          name: "node-2",
          cpu: { available: 1000 },
          memory: { available: 1000 },
          gpu: [{ vendor: "nvidia", model: "a100", available: 2 }],
          eph_storage: { available: 0 },
          persistent_storage: []
        }
      ],
      storage: []
    });

    expect(result.gpuModels).toEqual(["amd/mi300x", "nvidia/a100"]);
  });

  it("handles ephemeral-only storage", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000 },
          memory: { available: 1000 },
          gpu: [],
          eph_storage: { available: 500_000_000_000 },
          persistent_storage: []
        }
      ],
      storage: []
    });

    expect(result.totalAvailableEph).toBe(500_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(0n);
    expect(result.storageClasses).toEqual([]);
  });

  it("handles persistent-only storage with multiple classes", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000 },
          memory: { available: 1000 },
          gpu: [],
          eph_storage: { available: 0 },
          persistent_storage: [
            { class: "beta2", available: 100_000_000_000 },
            { class: "beta3", available: 200_000_000_000 }
          ]
        }
      ],
      storage: []
    });

    expect(result.totalAvailablePersistent).toBe(300_000_000_000n);
    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("collects storage classes from both nodes and cluster-level storage", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 0 },
          memory: { available: 0 },
          gpu: [],
          eph_storage: { available: 0 },
          persistent_storage: [{ class: "beta2", available: 100 }]
        }
      ],
      storage: [{ class: "beta3", available: 500 }]
    });

    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("handles nodes with no GPUs", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 4000 },
          memory: { available: 8_000_000_000 },
          gpu: [],
          eph_storage: { available: 100_000_000_000 },
          persistent_storage: []
        }
      ],
      storage: []
    });

    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
    expect(result.gpuModels).toEqual([]);
  });

  it("clamps negative values to zero (overcommit)", () => {
    const result = setup({
      nodes: [
        {
          name: "overcommitted",
          cpu: { available: -500 },
          memory: { available: -1_000_000 },
          gpu: [{ vendor: "nvidia", model: "a100", available: -1 }],
          eph_storage: { available: -100 },
          persistent_storage: [{ class: "beta2", available: -200 }]
        }
      ],
      storage: []
    });

    expect(result.totalAvailableCpu).toBe(0n);
    expect(result.totalAvailableMemory).toBe(0n);
    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.totalAvailableEph).toBe(0n);
    expect(result.totalAvailablePersistent).toBe(0n);
    expect(result.maxNodeFreeCpu).toBe(0n);
    expect(result.maxNodeFreeMemory).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
  });

  it("handles all-zero capacity", () => {
    const result = setup({
      nodes: [
        {
          name: "idle",
          cpu: { available: 0 },
          memory: { available: 0 },
          gpu: [],
          eph_storage: { available: 0 },
          persistent_storage: []
        }
      ],
      storage: []
    });

    expect(result.totalAvailableCpu).toBe(0n);
    expect(result.totalAvailableMemory).toBe(0n);
    expect(result.maxNodeFreeCpu).toBe(0n);
    expect(result.maxNodeFreeMemory).toBe(0n);
  });

  it("sums GPU count per node for max-node-free-gpu", () => {
    const result = setup({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 0 },
          memory: { available: 0 },
          gpu: [
            { vendor: "nvidia", model: "a100", available: 2 },
            { vendor: "nvidia", model: "h100", available: 3 }
          ],
          eph_storage: { available: 0 },
          persistent_storage: []
        },
        {
          name: "node-2",
          cpu: { available: 0 },
          memory: { available: 0 },
          gpu: [{ vendor: "nvidia", model: "a100", available: 4 }],
          eph_storage: { available: 0 },
          persistent_storage: []
        }
      ],
      storage: []
    });

    expect(result.maxNodeFreeGpu).toBe(5n);
    expect(result.totalAvailableGpu).toBe(9n);
    expect(result.gpuModels).toEqual(["nvidia/a100", "nvidia/h100"]);
  });

  function setup(inventory: Inventory) {
    return computeRollups(inventory);
  }
});
