import { describe, expect, it } from "vitest";

import type { ClusterState, GpuInfo, NodeState } from "@src/types/inventory";
import { isEqualClusterState } from "./is-equal-cluster-state";

describe(isEqualClusterState.name, () => {
  describe("empty state", () => {
    it("considers two empty rows equal", () => {
      expect(isEqualClusterState(buildCluster(), buildCluster())).toBe(true);
    });

    it("considers a row equal to itself", () => {
      const row = buildCluster();
      expect(isEqualClusterState(row, row)).toBe(true);
    });
  });

  describe("all fields equal", () => {
    it("considers two structurally identical fully-populated rows equal", () => {
      const a = buildCluster({
        nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })],
        storage: storageMap([{ class: "beta2", allocatable: 100n }]),
        leasedIp: { allocatable: 10n, allocated: 2n },
        reclamationWindow: 60
      });
      const b = buildCluster({
        nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })],
        storage: storageMap([{ class: "beta2", allocatable: 100n }]),
        leasedIp: { allocatable: 10n, allocated: 2n },
        reclamationWindow: 60
      });

      expect(isEqualClusterState(a, b)).toBe(true);
    });
  });

  describe("ClusterState-nested differs", () => {
    it("returns false when a node's cpu allocatable differs", () => {
      const a = buildCluster({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildCluster({ nodes: [buildNode({ cpu: { allocatable: 2000n, allocated: 0n } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's cpu allocated differs", () => {
      const a = buildCluster({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildCluster({ nodes: [buildNode({ cpu: { allocatable: 1000n, allocated: 500n } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's memory differs", () => {
      const a = buildCluster({ nodes: [buildNode({ memory: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildCluster({ nodes: [buildNode({ memory: { allocatable: 2000n, allocated: 0n } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's ephemeralStorage differs", () => {
      const a = buildCluster({ nodes: [buildNode({ ephemeralStorage: { allocatable: 1000n, allocated: 0n } })] });
      const b = buildCluster({ nodes: [buildNode({ ephemeralStorage: { allocatable: 2000n, allocated: 0n } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's name differs", () => {
      const a = buildCluster({ nodes: [buildNode({ name: "node-1" })] });
      const b = buildCluster({ nodes: [buildNode({ name: "node-2" })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's gpu quantity differs", () => {
      const a = buildCluster({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      const b = buildCluster({ nodes: [buildNode({ gpu: { quantity: { allocatable: 2n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's gpu info differs", () => {
      const a = buildCluster({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("nvidia", "a100")] } })] });
      const b = buildCluster({ nodes: [buildNode({ gpu: { quantity: { allocatable: 1n, allocated: 0n }, info: [gpu("amd", "mi300x")] } })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when a node's storageClasses differ", () => {
      const a = buildCluster({ nodes: [buildNode({ storageClasses: ["beta2"] })] });
      const b = buildCluster({ nodes: [buildNode({ storageClasses: ["beta3"] })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when cluster-level storage class differs", () => {
      const a = buildCluster({ storage: storageMap([{ class: "beta2", allocatable: 100n }]) });
      const b = buildCluster({ storage: storageMap([{ class: "beta3", allocatable: 100n }]) });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when cluster-level storage quantity differs", () => {
      const a = buildCluster({ storage: storageMap([{ class: "beta2", allocatable: 100n }]) });
      const b = buildCluster({ storage: storageMap([{ class: "beta2", allocatable: 200n }]) });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when node count differs", () => {
      const a = buildCluster({ nodes: [buildNode({ name: "node-1" })] });
      const b = buildCluster({ nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })] });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when leasedIp allocatable differs", () => {
      const a = buildCluster({ leasedIp: { allocatable: 10n, allocated: 0n } });
      const b = buildCluster({ leasedIp: { allocatable: 20n, allocated: 0n } });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when leasedIp allocated differs", () => {
      const a = buildCluster({ leasedIp: { allocatable: 10n, allocated: 0n } });
      const b = buildCluster({ leasedIp: { allocatable: 10n, allocated: 5n } });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when reclamationWindow differs", () => {
      const a = buildCluster({ reclamationWindow: 60 });
      const b = buildCluster({ reclamationWindow: 120 });
      expect(isEqualClusterState(a, b)).toBe(false);
    });

    it("returns false when reclamationWindow is set on only one side", () => {
      const a = buildCluster({ reclamationWindow: 60 });
      const b = buildCluster();
      expect(isEqualClusterState(a, b)).toBe(false);
    });
  });

  describe("order-insensitive comparison", () => {
    it("ignores order of nodes", () => {
      const a = buildCluster({ nodes: [buildNode({ name: "node-1" }), buildNode({ name: "node-2" })] });
      const b = buildCluster({ nodes: [buildNode({ name: "node-2" }), buildNode({ name: "node-1" })] });
      expect(isEqualClusterState(a, b)).toBe(true);
    });

    it("ignores order of gpu info within a node", () => {
      const a = buildCluster({
        nodes: [buildNode({ gpu: { quantity: { allocatable: 3n, allocated: 0n }, info: [gpu("nvidia", "a100"), gpu("amd", "mi300x")] } })]
      });
      const b = buildCluster({
        nodes: [buildNode({ gpu: { quantity: { allocatable: 3n, allocated: 0n }, info: [gpu("amd", "mi300x"), gpu("nvidia", "a100")] } })]
      });
      expect(isEqualClusterState(a, b)).toBe(true);
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

function buildCluster(overrides: Partial<ClusterState> = {}) {
  const cluster: ClusterState = {
    nodes: overrides.nodes ?? [],
    storage: overrides.storage ?? Object.create(null),
    leasedIp: overrides.leasedIp,
    reclamationWindow: overrides.reclamationWindow
  };
  return cluster;
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
