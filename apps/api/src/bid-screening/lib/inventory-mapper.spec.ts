import { describe, expect, it } from "vitest";

import type { ProviderWithSnapshot } from "../types/provider";
import { mapSnapshotToInventory } from "./inventory-mapper";

describe(mapSnapshotToInventory.name, () => {
  it("converts node CPU resources to bigint ResourcePairState", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].cpu.toState().allocatable).toBe(8000n);
    expect(inventory.nodes[0].cpu.toState().allocated).toBe(2000n);
  });

  it("converts node memory resources to bigint ResourcePairState", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].memory.toState().allocatable).toBe(17179869184n);
    expect(inventory.nodes[0].memory.toState().allocated).toBe(4294967296n);
  });

  it("converts node ephemeral storage resources to bigint ResourcePairState", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].ephemeralStorage.toState().allocatable).toBe(107374182400n);
    expect(inventory.nodes[0].ephemeralStorage.toState().allocated).toBe(0n);
  });

  it("maps GPU info from snapshot node GPUs", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].gpu.info).toEqual([{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]);
    expect(inventory.nodes[0].gpu.quantity.toState().allocatable).toBe(1n);
  });

  it("maps storage class capabilities from node booleans", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].storageClasses).toEqual(["beta2"]);
  });

  it("maps cluster storage pools", () => {
    const { inventory } = setup({});
    expect(inventory.storage["beta2"].class).toBe("beta2");
    expect(inventory.storage["beta2"].quantity.toState()).toEqual({ allocatable: 536870912000n, allocated: 0n });
  });

  it("maps CPU info from snapshot node CPUs", () => {
    const { inventory } = setup({});
    expect(inventory.nodes[0].cpus).toEqual([{ vendor: "GenuineIntel", model: "Intel Xeon Platinum 8375C" }]);
  });

  it("handles empty node list", () => {
    const { inventory } = setup({ emptyNodes: true });
    expect(inventory.nodes).toEqual([]);
  });

  it("handles nodes with all storage class capabilities", () => {
    const { inventory } = setup({ allStorageClasses: true });
    expect(inventory.nodes[0].storageClasses).toEqual(["beta1", "beta2", "beta3"]);
  });

  function setup(input: { emptyNodes?: boolean; allStorageClasses?: boolean }) {
    const provider: ProviderWithSnapshot = {
      owner: "akash1abc",
      hostUri: "https://provider.example.com:8443",
      ipRegion: "us-east",
      uptime7d: 0.998,
      lastSuccessfulSnapshot: {
        nodes: input.emptyNodes
          ? []
          : [
              {
                name: "node1",
                cpuAllocatable: 8000,
                cpuAllocated: 2000,
                memoryAllocatable: 17179869184,
                memoryAllocated: 4294967296,
                ephemeralStorageAllocatable: 107374182400,
                ephemeralStorageAllocated: 0,
                gpuAllocatable: 1,
                gpuAllocated: 0,
                capabilitiesStorageHDD: input.allStorageClasses ?? false,
                capabilitiesStorageSSD: true,
                capabilitiesStorageNVME: input.allStorageClasses ?? false,
                gpus: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }],
                cpus: [{ vendor: "GenuineIntel", model: "Intel Xeon Platinum 8375C", vcores: 4 }]
              }
            ],
        storage: [{ class: "beta2", allocatable: 536870912000, allocated: 0 }]
      }
    };

    const inventory = mapSnapshotToInventory(provider);
    return { inventory, provider };
  }
});
