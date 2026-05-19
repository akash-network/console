import { describe, expect, it } from "vitest";

import { ResourcePair } from "@src/lib/resource-pair/resource-pair";
import type { ClusterState, GpuInfo, NodeState } from "@src/types/inventory.types";
import { projectRow } from "./project-row";

describe(projectRow.name, () => {
  it("projects an empty cluster", () => {
    const result = projectRow(buildCluster());

    expect(result).toEqual({
      cluster: { nodes: [], storage: {} },
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

  it("passes ClusterState through unchanged", () => {
    const cluster = buildCluster({
      nodes: [buildNode({ cpu: pair(8000n) })],
      storage: { beta2: { class: "beta2", quantity: pair(2_000_000_000_000n) } }
    });

    const result = projectRow(cluster);

    expect(result.cluster).toBe(cluster);
  });

  it("computes rollups for a single node", () => {
    const result = projectRow(
      buildCluster({
        nodes: [
          buildNode({
            cpu: pair(4000n),
            memory: pair(8_000_000_000n),
            ephemeralStorage: pair(100_000_000_000n),
            gpu: { quantity: pair(2n), info: [gpu("nvidia", "a100")] },
            storageClasses: ["beta2"]
          })
        ],
        storage: { beta2: { class: "beta2", quantity: pair(500_000_000_000n) } }
      })
    );

    expect(result.totalAvailableCpu).toBe(4000n);
    expect(result.totalAvailableMemory).toBe(8_000_000_000n);
    expect(result.totalAvailableGpu).toBe(2n);
    expect(result.totalAvailableEph).toBe(100_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(500_000_000_000n);
    expect(result.maxNodeFreeCpu).toBe(4000n);
    expect(result.maxNodeFreeMemory).toBe(8_000_000_000n);
    expect(result.maxNodeFreeGpu).toBe(2n);
    expect(result.gpuModels).toEqual(["nvidia", "nvidia/a100"]);
    expect(result.storageClasses).toEqual(["beta2"]);
  });

  it("sums totals across multiple nodes and tracks max-per-node", () => {
    const result = projectRow(
      buildCluster({
        nodes: [
          buildNode({
            cpu: pair(2000n),
            memory: pair(4_000_000_000n),
            ephemeralStorage: pair(50_000_000_000n),
            gpu: { quantity: pair(1n), info: [gpu("nvidia", "a100")] }
          }),
          buildNode({
            cpu: pair(8000n),
            memory: pair(16_000_000_000n),
            ephemeralStorage: pair(200_000_000_000n),
            gpu: { quantity: pair(4n), info: [gpu("nvidia", "a100")] }
          })
        ]
      })
    );

    expect(result.totalAvailableCpu).toBe(10_000n);
    expect(result.totalAvailableMemory).toBe(20_000_000_000n);
    expect(result.totalAvailableGpu).toBe(5n);
    expect(result.totalAvailableEph).toBe(250_000_000_000n);
    expect(result.maxNodeFreeCpu).toBe(8000n);
    expect(result.maxNodeFreeMemory).toBe(16_000_000_000n);
    expect(result.maxNodeFreeGpu).toBe(4n);
  });

  it("deduplicates GPU models across nodes", () => {
    const result = projectRow(
      buildCluster({
        nodes: [
          buildNode({ gpu: { quantity: pair(2n), info: [gpu("nvidia", "a100"), gpu("amd", "mi300x")] } }),
          buildNode({ gpu: { quantity: pair(2n), info: [gpu("nvidia", "a100")] } })
        ]
      })
    );

    expect(result.gpuModels).toEqual(["amd", "amd/mi300x", "nvidia", "nvidia/a100"]);
  });

  it("handles ephemeral-only storage", () => {
    const result = projectRow(buildCluster({ nodes: [buildNode({ ephemeralStorage: pair(500_000_000_000n) })] }));

    expect(result.totalAvailableEph).toBe(500_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(0n);
    expect(result.storageClasses).toEqual([]);
  });

  it("collects storage classes from both nodes and cluster-level storage", () => {
    const result = projectRow(
      buildCluster({
        nodes: [buildNode({ storageClasses: ["beta2"] })],
        storage: { beta3: { class: "beta3", quantity: pair(500n) } }
      })
    );

    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("handles nodes with no GPUs", () => {
    const result = projectRow(
      buildCluster({
        nodes: [buildNode({ cpu: pair(4000n), memory: pair(8_000_000_000n), ephemeralStorage: pair(100_000_000_000n) })]
      })
    );

    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
    expect(result.gpuModels).toEqual([]);
  });

  it("treats over-allocated nodes as zero available (no negative leakage)", () => {
    const result = projectRow(
      buildCluster({
        nodes: [
          buildNode({
            cpu: new ResourcePair(500n, 1000n),
            memory: new ResourcePair(1_000_000n, 2_000_000n),
            gpu: { quantity: new ResourcePair(0n, 1n), info: [gpu("nvidia", "a100")] },
            ephemeralStorage: new ResourcePair(100n, 200n)
          })
        ]
      })
    );

    expect(result.totalAvailableCpu).toBe(0n);
    expect(result.totalAvailableMemory).toBe(0n);
    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.totalAvailableEph).toBe(0n);
    expect(result.maxNodeFreeCpu).toBe(0n);
    expect(result.maxNodeFreeMemory).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
  });

  it("sums GPU count per node for max-node-free-gpu", () => {
    const result = projectRow(
      buildCluster({
        nodes: [
          buildNode({ gpu: { quantity: pair(5n), info: [gpu("nvidia", "a100"), gpu("nvidia", "h100")] } }),
          buildNode({ gpu: { quantity: pair(4n), info: [gpu("nvidia", "a100")] } })
        ]
      })
    );

    expect(result.maxNodeFreeGpu).toBe(5n);
    expect(result.totalAvailableGpu).toBe(9n);
    expect(result.gpuModels).toEqual(["nvidia", "nvidia/a100", "nvidia/h100"]);
  });
});

function pair(allocatable: bigint): ResourcePair {
  return new ResourcePair(allocatable, 0n);
}

function gpu(vendor: string, name: string): GpuInfo {
  return { vendor, name, modelId: "", interface: "", memorySize: "" };
}

function buildNode(overrides?: Partial<NodeState>): NodeState {
  return {
    name: "node-1",
    cpu: pair(0n),
    memory: pair(0n),
    ephemeralStorage: pair(0n),
    gpu: { quantity: pair(0n), info: [] },
    storageClasses: [],
    cpus: [],
    ...overrides
  };
}

function buildCluster(overrides?: Partial<ClusterState>): ClusterState {
  return {
    nodes: overrides?.nodes ?? [],
    storage: overrides?.storage ?? Object.create(null)
  };
}
