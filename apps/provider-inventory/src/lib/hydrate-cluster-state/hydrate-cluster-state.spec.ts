import { describe, expect, it } from "vitest";

import { hydrateClusterState } from "./hydrate-cluster-state";

describe(hydrateClusterState.name, () => {
  it("rebuilds nodes with ResourcePair instances from persisted plain objects", () => {
    const cluster = hydrateClusterState({
      nodes: [
        {
          name: "node1",
          cpu: { allocatable: 8000, allocated: 2000 },
          memory: { allocatable: 17179869184, allocated: 4294967296 },
          ephemeralStorage: { allocatable: 107374182400, allocated: 0 },
          gpu: { quantity: { allocatable: 0, allocated: 0 }, info: [] },
          storageClasses: ["beta2"],
          cpus: []
        }
      ],
      storage: {}
    });

    const node = cluster.nodes[0];
    expect(node.name).toBe("node1");
    expect(node.cpu.allocatable).toBe(8000n);
    expect(node.cpu.allocated).toBe(2000n);
    expect(node.memory.allocatable).toBe(17179869184n);
    expect(node.memory.allocated).toBe(4294967296n);
    expect(node.ephemeralStorage.allocatable).toBe(107374182400n);
    expect(node.ephemeralStorage.allocated).toBe(0n);
    expect(node.storageClasses).toEqual(["beta2"]);
  });

  it("hydrates cluster storage pools as ResourcePair entries keyed by class", () => {
    const cluster = hydrateClusterState({
      nodes: [],
      storage: { beta2: { class: "beta2", quantity: { allocatable: 536870912000, allocated: 0 } } }
    });

    const beta2 = cluster.storage["beta2"];
    expect(beta2.class).toBe("beta2");
    expect(beta2.quantity.allocatable).toBe(536870912000n);
    expect(beta2.quantity.allocated).toBe(0n);
  });

  it("preserves bigint magnitudes that exceed Number.MAX_SAFE_INTEGER", () => {
    const unsafe = 9007199254740993n;
    const cluster = hydrateClusterState({
      nodes: [
        {
          name: "node1",
          cpu: { allocatable: unsafe, allocated: 0 },
          memory: { allocatable: 0, allocated: 0 },
          ephemeralStorage: { allocatable: 0, allocated: 0 },
          gpu: { quantity: { allocatable: 0, allocated: 0 }, info: [] },
          storageClasses: [],
          cpus: []
        }
      ],
      storage: {}
    });

    expect(cluster.nodes[0].cpu.allocatable).toBe(unsafe);
  });

  it("returns empty cluster for nullish input", () => {
    const cluster = hydrateClusterState(undefined);
    expect(cluster.nodes).toEqual([]);
    expect(cluster.storage).toEqual({});
  });
});
