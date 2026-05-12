import { describe, expect, it } from "vitest";

import { projectRow } from "./project-row";

describe(projectRow.name, () => {
  it("projects an empty cluster", () => {
    const result = projectRow({ nodes: [], storage: [] });

    expect(result.inventory).toEqual({ nodes: [], storage: [] });
    expect(result.totalAvailableCpu).toBe(0n);
    expect(result.totalAvailableMemory).toBe(0n);
    expect(result.totalAvailableGpu).toBe(0n);
    expect(result.gpuModels).toEqual([]);
    expect(result.storageClasses).toEqual([]);
  });

  it("normalizes a single node into inventory JSONB and computes rollups", () => {
    const result = projectRow({
      nodes: [
        {
          name: "node-1",
          cpuAvailable: 8000,
          memoryAvailable: 32_000_000_000,
          gpus: [{ vendor: "nvidia", model: "rtx4090", available: 1, memorySize: "24Gi", interface: "PCIe", modelId: "2684" }],
          ephStorageAvailable: 500_000_000_000,
          persistentStorage: [{ class: "beta2", available: 1_000_000_000_000 }]
        }
      ],
      storage: [{ class: "beta2", available: 2_000_000_000_000 }]
    });

    expect(result.inventory.nodes).toHaveLength(1);
    expect(result.inventory.nodes[0]).toEqual({
      name: "node-1",
      cpu: { available: 8000 },
      memory: { available: 32_000_000_000 },
      gpu: [{ vendor: "nvidia", model: "rtx4090", available: 1, memorySize: "24Gi", interface: "PCIe", modelId: "2684" }],
      ephStorage: { available: 500_000_000_000 },
      persistentStorage: [{ class: "beta2", available: 1_000_000_000_000 }]
    });
    expect(result.inventory.storage).toEqual([{ class: "beta2", available: 2_000_000_000_000 }]);

    expect(result.totalAvailableCpu).toBe(8000n);
    expect(result.totalAvailableGpu).toBe(1n);
    expect(result.gpuModels).toEqual(["nvidia/rtx4090"]);
    expect(result.storageClasses).toEqual(["beta2"]);
  });

  it("projects a multi-node cluster with correct max-per-node tracking", () => {
    const result = projectRow({
      nodes: [
        {
          name: "small",
          cpuAvailable: 2000,
          memoryAvailable: 4_000_000_000,
          gpus: [],
          ephStorageAvailable: 50_000_000_000,
          persistentStorage: []
        },
        {
          name: "large",
          cpuAvailable: 16000,
          memoryAvailable: 64_000_000_000,
          gpus: [{ vendor: "nvidia", model: "a100", available: 8, memorySize: "80Gi", interface: "PCIe", modelId: "20b5" }],
          ephStorageAvailable: 1_000_000_000_000,
          persistentStorage: [{ class: "beta3", available: 2_000_000_000_000 }]
        }
      ],
      storage: []
    });

    expect(result.inventory.nodes).toHaveLength(2);
    expect(result.totalAvailableCpu).toBe(18_000n);
    expect(result.maxNodeFreeCpu).toBe(16_000n);
    expect(result.totalAvailableMemory).toBe(68_000_000_000n);
    expect(result.maxNodeFreeMemory).toBe(64_000_000_000n);
    expect(result.totalAvailableGpu).toBe(8n);
    expect(result.maxNodeFreeGpu).toBe(8n);
  });
});
