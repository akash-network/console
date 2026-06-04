import { describe, expect, it } from "vitest";

import type { ClusterState, GpuInfo, NodeState, RawPair } from "@src/types/inventory";
import { mapToStoredClusterState } from "./stored-cluster-state-mapper";

describe(mapToStoredClusterState.name, () => {
  it("projects an empty cluster", () => {
    const result = mapToStoredClusterState(buildCluster());

    expect(result).toEqual({
      cluster: { nodes: [], storage: {} },
      totalAvailableCpu: 0n,
      totalAvailableMemory: 0n,
      totalAvailableGpu: 0n,
      totalAvailableEph: 0n,
      totalAvailablePersistent: 0n,
      totalAvailableLeasedIp: 0n,
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

    const result = mapToStoredClusterState(cluster);

    expect(result.cluster).toBe(cluster);
  });

  it("computes rollups for a single node", () => {
    const result = mapToStoredClusterState(
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
        storage: { beta2: { class: "beta2", quantity: pair(500_000_000_000n) } },
        leasedIp: pair(10n)
      })
    );

    expect(result.totalAvailableCpu).toBe(4000n);
    expect(result.totalAvailableMemory).toBe(8_000_000_000n);
    expect(result.totalAvailableGpu).toBe(2n);
    expect(result.totalAvailableEph).toBe(100_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(500_000_000_000n);
    expect(result.totalAvailableLeasedIp).toBe(10n);
    expect(result.maxNodeFreeCpu).toBe(4000n);
    expect(result.maxNodeFreeMemory).toBe(8_000_000_000n);
    expect(result.maxNodeFreeGpu).toBe(2n);
    expect(result.gpuModels).toEqual(["nvidia", "nvidia/a100"]);
    expect(result.storageClasses).toEqual(["beta2"]);
  });

  it("sums totals across multiple nodes and tracks max-per-node", () => {
    const result = mapToStoredClusterState(
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
    const result = mapToStoredClusterState(
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
    const result = mapToStoredClusterState(buildCluster({ nodes: [buildNode({ ephemeralStorage: pair(500_000_000_000n) })] }));

    expect(result.totalAvailableEph).toBe(500_000_000_000n);
    expect(result.totalAvailablePersistent).toBe(0n);
    expect(result.storageClasses).toEqual([]);
  });

  it("collects storage classes from both nodes and cluster-level storage", () => {
    const result = mapToStoredClusterState(
      buildCluster({
        nodes: [buildNode({ storageClasses: ["beta2"] })],
        storage: { beta3: { class: "beta3", quantity: pair(500n) } }
      })
    );

    expect(result.storageClasses).toEqual(["beta2", "beta3"]);
  });

  it("handles nodes with no GPUs", () => {
    const result = mapToStoredClusterState(
      buildCluster({
        nodes: [buildNode({ cpu: pair(4000n), memory: pair(8_000_000_000n), ephemeralStorage: pair(100_000_000_000n) })]
      })
    );

    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.maxNodeFreeGpu).toBe(0n);
    expect(result.gpuModels).toEqual([]);
  });

  it("treats over-allocated nodes as zero available (no negative leakage)", () => {
    const result = mapToStoredClusterState(
      buildCluster({
        nodes: [
          buildNode({
            cpu: { allocatable: 500n, allocated: 1000n },
            memory: { allocatable: 1_000_000n, allocated: 2_000_000n },
            gpu: { quantity: { allocatable: 0n, allocated: 1n }, info: [gpu("nvidia", "a100")] },
            ephemeralStorage: { allocatable: 100n, allocated: 200n }
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
    const result = mapToStoredClusterState(
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

function pair(allocatable: bigint): RawPair {
  return { allocatable: allocatable, allocated: 0n };
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
    ...overrides,
    nodes: overrides?.nodes ?? [],
    storage: overrides?.storage ?? Object.create(null)
  };
}
