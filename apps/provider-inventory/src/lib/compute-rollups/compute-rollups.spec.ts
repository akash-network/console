import { describe, expect, it } from "vitest";

import { computeRollups } from "./compute-rollups";

describe(computeRollups.name, () => {
  it("returns all zeros for an empty cluster", () => {
    const result = computeRollups({ nodes: [], storage: [] });

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
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 4000n },
          memory: { available: 8_000_000_000n },
          gpu: [{ vendor: "nvidia", model: "a100", available: 2n }],
          ephStorage: { available: 100_000_000_000n },
          persistentStorage: [{ class: "beta2", available: 500_000_000_000n }]
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
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 2000n },
          memory: { available: 4_000_000_000n },
          gpu: [{ vendor: "nvidia", model: "a100", available: 1n }],
          ephStorage: { available: 50_000_000_000n },
          persistentStorage: []
        },
        {
          name: "node-2",
          cpu: { available: 8000n },
          memory: { available: 16_000_000_000n },
          gpu: [{ vendor: "nvidia", model: "a100", available: 4n }],
          ephStorage: { available: 200_000_000_000n },
          persistentStorage: [{ class: "beta2", available: 1_000_000_000_000n }]
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
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000n },
          memory: { available: 1000n },
          gpu: [
            { vendor: "nvidia", model: "a100", available: 1n },
            { vendor: "amd", model: "mi300x", available: 1n }
          ],
          ephStorage: { available: 0n },
          persistentStorage: []
        },
        {
          name: "node-2",
          cpu: { available: 1000n },
          memory: { available: 1000n },
          gpu: [{ vendor: "nvidia", model: "a100", available: 2n }],
          ephStorage: { available: 0n },
          persistentStorage: []
        }
      ],
      storage: []
    });

    expect(result.gpuModels).toEqual(["amd/mi300x", "nvidia/a100"]);
  });

  it("handles ephemeral-only storage", () => {
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000n },
          memory: { available: 1000n },
          gpu: [],
          ephStorage: { available: 500_000_000_000n },
          persistentStorage: []
        }
      ],
      storage: []
    });

    expect(result.totalAvailableEph).toBe(500_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(0n);
    expect(result.storageClasses).toEqual([]);
  });

  it("handles persistent-only storage with multiple classes", () => {
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 1000n },
          memory: { available: 1000n },
          gpu: [],
          ephStorage: { available: 0n },
          persistentStorage: [
            { class: "beta2", available: 100_000_000_000n },
            { class: "beta3", available: 200_000_000_000n }
          ]
        }
      ],
      storage: []
    });

    expect(result.totalAvailablePersistent).toBe(300_000_000_000n);
    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("collects storage classes from both nodes and cluster-level storage", () => {
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 0n },
          memory: { available: 0n },
          gpu: [],
          ephStorage: { available: 0n },
          persistentStorage: [{ class: "beta2", available: 100n }]
        }
      ],
      storage: [{ class: "beta3", available: 500n }]
    });

    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("handles nodes with no GPUs", () => {
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 4000n },
          memory: { available: 8_000_000_000n },
          gpu: [],
          ephStorage: { available: 100_000_000_000n },
          persistentStorage: []
        }
      ],
      storage: []
    });

    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
    expect(result.gpuModels).toEqual([]);
  });

  it("clamps negative values to zero (overcommit)", () => {
    const result = computeRollups({
      nodes: [
        {
          name: "overcommitted",
          cpu: { available: -500n },
          memory: { available: -1_000_000n },
          gpu: [{ vendor: "nvidia", model: "a100", available: -1n }],
          ephStorage: { available: -100n },
          persistentStorage: [{ class: "beta2", available: -200n }]
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
    const result = computeRollups({
      nodes: [
        {
          name: "idle",
          cpu: { available: 0n },
          memory: { available: 0n },
          gpu: [],
          ephStorage: { available: 0n },
          persistentStorage: []
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
    const result = computeRollups({
      nodes: [
        {
          name: "node-1",
          cpu: { available: 0n },
          memory: { available: 0n },
          gpu: [
            { vendor: "nvidia", model: "a100", available: 2n },
            { vendor: "nvidia", model: "h100", available: 3n }
          ],
          ephStorage: { available: 0n },
          persistentStorage: []
        },
        {
          name: "node-2",
          cpu: { available: 0n },
          memory: { available: 0n },
          gpu: [{ vendor: "nvidia", model: "a100", available: 4n }],
          ephStorage: { available: 0n },
          persistentStorage: []
        }
      ],
      storage: []
    });

    expect(result.maxNodeFreeGpu).toBe(5n);
    expect(result.totalAvailableGpu).toBe(9n);
    expect(result.gpuModels).toEqual(["nvidia/a100", "nvidia/h100"]);
  });
});
