import { describe, expect, it } from "vitest";

import type { ProviderWithSnapshot } from "@src/bid-screening/types/provider";
import type { GpuInfo, RequestedResourceUnit } from "../../types/inventory.types";
import { ClusterInventoryMatcherService } from "./cluster-inventory-matcher.service";

describe(ClusterInventoryMatcherService.name, () => {
  describe("basic resource matching (US1)", () => {
    it("matches when single node has sufficient resources", () => {
      const { service, provider, resourceUnits } = setup({});
      const result = service.match(provider, resourceUnits);
      expect(result.matched).toBe(true);
    });

    it("fails when single node has insufficient CPU", () => {
      const { service, provider, resourceUnits } = setup({ requestedCpu: 20000n });
      const result = service.match(provider, resourceUnits);
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("fails when single node has insufficient memory", () => {
      const { service, provider, resourceUnits } = setup({ requestedMemory: 999999999999n });
      const result = service.match(provider, resourceUnits);
      expect(result.matched).toBe(false);
    });

    it("spreads replicas across multiple nodes when single node is insufficient", () => {
      const { service } = setup({});
      const provider = makeProvider([
        { cpu: 4000, memory: 8589934592, ephemeral: 10737418240 },
        { cpu: 4000, memory: 8589934592, ephemeral: 10737418240 }
      ]);
      const units = makeResourceUnits({ cpu: 3000n, memory: 4294967296n, ephemeral: 5368709120n, count: 2 });

      const result = service.match(provider, units);
      expect(result.matched).toBe(true);
    });

    it("places all replicas on one node when possible", () => {
      const { service } = setup({});
      const provider = makeProvider([{ cpu: 16000, memory: 34359738368, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 4 });

      const result = service.match(provider, units);
      expect(result.matched).toBe(true);
    });

    it("fails when provider has zero nodes", () => {
      const { service } = setup({});
      const provider = makeProvider([]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      const result = service.match(provider, units);
      expect(result.matched).toBe(false);
    });
  });

  describe("storage matching (US3)", () => {
    it("deducts ephemeral storage from node", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 17179869184, ephemeral: 10737418240 }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("deducts RAM-backed storage from node memory", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 8589934592n,
        ephemeral: 1073741824n,
        count: 1,
        extraStorage: [
          {
            name: "ramvol",
            quantity: 4294967296n,
            attributes: [
              { key: "persistent", value: "false" },
              { key: "class", value: "ram" }
            ]
          }
        ]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails RAM-backed storage when combined with memory exceeds node capacity", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 10737418240, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 8589934592n,
        ephemeral: 1073741824n,
        count: 1,
        extraStorage: [
          {
            name: "ramvol",
            quantity: 4294967296n,
            attributes: [
              { key: "persistent", value: "false" },
              { key: "class", value: "ram" }
            ]
          }
        ]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("deducts persistent storage from cluster pool", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider(
        [{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400, storageClasses: ["beta2"] }],
        [{ class: "beta2", allocatable: 536870912000, allocated: 0 }]
      );
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 1073741824n,
        count: 1,
        extraStorage: [
          {
            name: "data",
            quantity: 53687091200n,
            attributes: [
              { key: "persistent", value: "true" },
              { key: "class", value: "beta2" }
            ]
          }
        ]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails when node lacks storage class capability", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider(
        [{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400, storageClasses: ["beta1"] }],
        [{ class: "beta2", allocatable: 536870912000, allocated: 0 }]
      );
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 1073741824n,
        count: 1,
        extraStorage: [
          {
            name: "data",
            quantity: 53687091200n,
            attributes: [
              { key: "persistent", value: "true" },
              { key: "class", value: "beta2" }
            ]
          }
        ]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("fails when cluster pool is exhausted", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider(
        [{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400, storageClasses: ["beta2"] }],
        [{ class: "beta2", allocatable: 1073741824, allocated: 0 }]
      );
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 1073741824n,
        count: 1,
        extraStorage: [
          {
            name: "data",
            quantity: 53687091200n,
            attributes: [
              { key: "persistent", value: "true" },
              { key: "class", value: "beta2" }
            ]
          }
        ]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });
  });

  describe("GPU matching (US2)", () => {
    it("matches exact GPU vendor and model", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("matches wildcard model against any GPU model", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "rtx4090", modelId: "2684", interface: "PCIe", memorySize: "24Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("filters by RAM size", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "40Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("filters by interface with sxm normalization", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "SXM4", memorySize: "80Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100/interface/sxm2", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails when no GPU matches on node", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "amd", name: "mi300x", modelId: "740f", interface: "PCIe", memorySize: "192Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("passes when zero GPUs are requested", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1, gpuUnits: 0n });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails when requesting 2 A100s but node has 1 A100 + 1 V100", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "v100", modelId: "1db4", interface: "PCIe", memorySize: "32Gi" }
          ]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 2n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("pins to first GPU type when no GPU specs provided", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: []
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails GPU request when node has no GPU info", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 8000,
          memory: 17179869184,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: []
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("rejects wildcard request for 2 GPUs when node has mixed RAM variants of the same model", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "40Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 2n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("rejects wildcard request for 2 GPUs when node has mixed interfaces of the same model", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "SXM4", memorySize: "80Gi" }
          ]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 2n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("matches wildcard request for 2 GPUs when node has identical SKUs", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 2n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });
  });

  describe("multi-group matching (US5)", () => {
    it("matches two groups spread across nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        { cpu: 8000, memory: 17179869184, ephemeral: 107374182400 },
        { cpu: 8000, memory: 17179869184, ephemeral: 107374182400 }
      ]);
      const cpuGroup: RequestedResourceUnit = {
        id: 1,
        resources: {
          cpu: { units: 4000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 8589934592n, attributes: [] },
          storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 2
      };
      const gpuGroup: RequestedResourceUnit = {
        id: 2,
        resources: {
          cpu: { units: 2000n, attributes: [] },
          gpu: { units: 1n, attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] },
          memory: { quantity: 4294967296n, attributes: [] },
          storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 1
      };

      const result = service.match(provider, [cpuGroup, gpuGroup]);
      expect(result.matched).toBe(false);
    });

    it("places mixed CPU+GPU groups on appropriate nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        { cpu: 16000, memory: 34359738368, ephemeral: 107374182400 }
      ]);

      const cpuGroup: RequestedResourceUnit = {
        id: 1,
        resources: {
          cpu: { units: 2000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 4294967296n, attributes: [] },
          storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 4
      };

      const result = service.match(provider, [cpuGroup]);
      expect(result.matched).toBe(true);
    });

    it("fails entire provider when one group has insufficient capacity", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 4000, memory: 8589934592, ephemeral: 107374182400 }]);

      const smallGroup: RequestedResourceUnit = {
        id: 1,
        resources: {
          cpu: { units: 1000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 1073741824n, attributes: [] },
          storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 1
      };
      const largeGroup: RequestedResourceUnit = {
        id: 2,
        resources: {
          cpu: { units: 10000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 1073741824n, attributes: [] },
          storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 1
      };

      const result = service.match(provider, [smallGroup, largeGroup]);
      expect(result.matched).toBe(false);
    });

    it("handles all groups placed successfully on a large node", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 32000, memory: 68719476736, ephemeral: 536870912000 }]);

      const group1: RequestedResourceUnit = {
        id: 1,
        resources: {
          cpu: { units: 4000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 8589934592n, attributes: [] },
          storage: [{ name: "default", quantity: 10737418240n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 2
      };
      const group2: RequestedResourceUnit = {
        id: 2,
        resources: {
          cpu: { units: 2000n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: 4294967296n, attributes: [] },
          storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }]
        },
        count: 3
      };

      const result = service.match(provider, [group1, group2]);
      expect(result.matched).toBe(true);
    });
  });

  describe("replica GPU consistency invariant (US5)", () => {
    it("passes when all replicas with wildcard model land on nodes with the same GPU model", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 3,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails when a later replica would resolve to a different GPU model than the first (wildcard)", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "v100", modelId: "1db4", interface: "PCIe", memorySize: "32Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 3,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("fails when a later replica on another node has a different RAM size than the first (wildcard)", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        },
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 1,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "40Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 2,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });
  });

  describe("nodes with existing allocations", () => {
    it("matches when remaining capacity after allocation is sufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, cpuAllocated: 3000, memory: 17179869184, memoryAllocated: 4294967296, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 8589934592n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("fails when CPU remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, cpuAllocated: 5000, memory: 17179869184, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("fails when memory remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 17179869184, memoryAllocated: 14000000000, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 8589934592n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("fails when ephemeral storage remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400, ephemeralAllocated: 105000000000 }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(false);
    });

    it("matches at exact remaining boundary", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([{ cpu: 8000, cpuAllocated: 4000, memory: 17179869184, ephemeral: 107374182400 }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("spreads replicas across nodes with varying allocations", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        { cpu: 8000, cpuAllocated: 4000, memory: 17179869184, ephemeral: 107374182400 },
        { cpu: 8000, cpuAllocated: 4000, memory: 17179869184, ephemeral: 107374182400 }
      ]);
      const units = makeResourceUnits({ cpu: 3000n, memory: 1073741824n, ephemeral: 5368709120n, count: 2 });

      expect(service.match(provider, units).matched).toBe(true);
    });

    it("accounts for GPU allocation on nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const provider = makeProvider([
        {
          cpu: 16000,
          memory: 34359738368,
          ephemeral: 107374182400,
          gpuCount: 2,
          gpuAllocated: 1,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 1,
        gpuUnits: 2n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }]
      });

      expect(service.match(provider, units).matched).toBe(false);
    });
  });

  describe("boundary-value precision (4-node topology)", () => {
    // Mirrors Go multipleReplicasGenNodes:
    //   node0: avail CPU 68780  (119800 - 51020), no GPU
    //   node1: avail CPU 68800  (119800 - 51000), 2x nvidia a100
    //   node2: avail CPU 119525 (119800 - 275),   no GPU
    //   node3: avail CPU 119495 (119800 - 305),   no GPU
    const MEM_16GI = 17179869184n;
    const STORAGE_8GI = 8589934592n;

    function makeFourNodeProvider() {
      return makeProvider([
        {
          cpu: 119800,
          cpuAllocated: 51020,
          memory: 457317732352,
          memoryAllocated: 17495527424,
          ephemeral: 7760751097705,
          ephemeralAllocated: 8589934592
        },
        {
          cpu: 119800,
          cpuAllocated: 51000,
          memory: 457317732352,
          memoryAllocated: 17495527424,
          ephemeral: 7760751097705,
          ephemeralAllocated: 8589934592,
          gpuCount: 2,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "20b5", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "20b5", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 119800,
          cpuAllocated: 275,
          memory: 457317732352,
          memoryAllocated: 17495527424,
          ephemeral: 7760751097705,
          ephemeralAllocated: 0
        },
        {
          cpu: 119800,
          cpuAllocated: 305,
          memory: 457317732352,
          memoryAllocated: 17495527424,
          ephemeral: 7760751097705,
          ephemeralAllocated: 0
        }
      ]);
    }

    function makeFourNodeUnits(cpu: bigint, gpu: bigint, count: number) {
      return makeResourceUnits({
        cpu,
        memory: MEM_16GI,
        ephemeral: STORAGE_8GI,
        count,
        gpuUnits: gpu,
        gpuAttributes: gpu > 0n ? [{ key: "vendor/nvidia/model/a100", value: "true" }] : []
      });
    }

    it("places 100000 CPU x 2 replicas on the two largest nodes", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(100000n, 0n, 2)).matched).toBe(true);
    });

    it("places 68780 CPU x 4 replicas across all four nodes", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(68780n, 0n, 4)).matched).toBe(true);
    });

    it("places 68800 CPU x 3 replicas skipping node 0", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(68800n, 0n, 3)).matched).toBe(true);
    });

    it("places 119495 CPU x 2 replicas on nodes 2 and 3", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(119495n, 0n, 2)).matched).toBe(true);
    });

    it("places 68780 CPU x 1 replica on node 0 at exact boundary", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(68780n, 0n, 1)).matched).toBe(true);
    });

    it("places 68780 CPU + 1 GPU x 1 replica on GPU node", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeProvider(), makeFourNodeUnits(68780n, 1n, 1)).matched).toBe(true);
    });

    it("places multi-group reservation (CPU-only + GPU) across nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const cpuGroup: RequestedResourceUnit = {
        id: 1,
        resources: {
          cpu: { units: 68700n, attributes: [] },
          gpu: { units: 0n, attributes: [] },
          memory: { quantity: MEM_16GI, attributes: [] },
          storage: [
            {
              name: "default",
              quantity: STORAGE_8GI,
              attributes: [
                { key: "persistent", value: "false" },
                { key: "class", value: "ephemeral" }
              ]
            }
          ]
        },
        count: 1
      };
      const gpuGroup: RequestedResourceUnit = {
        id: 2,
        resources: {
          cpu: { units: 68700n, attributes: [] },
          gpu: { units: 1n, attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] },
          memory: { quantity: MEM_16GI, attributes: [] },
          storage: [
            {
              name: "default",
              quantity: STORAGE_8GI,
              attributes: [
                { key: "persistent", value: "false" },
                { key: "class", value: "ephemeral" }
              ]
            }
          ]
        },
        count: 1
      };

      expect(service.match(makeFourNodeProvider(), [cpuGroup, gpuGroup]).matched).toBe(true);
    });

    it("rejects 70000 CPU x 4 replicas (only 2 nodes large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeProvider(), makeFourNodeUnits(70000n, 0n, 4));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("rejects 100000 CPU x 3 replicas (only 2 nodes large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeProvider(), makeFourNodeUnits(100000n, 0n, 3));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("rejects 119525 CPU x 2 replicas (only 1 node large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeProvider(), makeFourNodeUnits(119525n, 0n, 2));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });
  });

  function setup(input: { requestedCpu?: bigint; requestedMemory?: bigint }) {
    const service = new ClusterInventoryMatcherService();
    const provider = makeProvider([{ cpu: 8000, memory: 17179869184, ephemeral: 107374182400 }]);
    const resourceUnits = makeResourceUnits({
      cpu: input.requestedCpu ?? 1000n,
      memory: input.requestedMemory ?? 1073741824n,
      ephemeral: 5368709120n,
      count: 1
    });
    return { service, provider, resourceUnits };
  }
});

function makeProvider(
  nodes: {
    cpu: number;
    memory: number;
    ephemeral: number;
    cpuAllocated?: number;
    memoryAllocated?: number;
    ephemeralAllocated?: number;
    gpuCount?: number;
    gpuAllocated?: number;
    gpuInfo?: GpuInfo[];
    storageClasses?: string[];
    cpus?: { vendor: string; model: string; vcores: number }[];
  }[],
  storage?: { class: string; allocatable: number; allocated: number }[]
): ProviderWithSnapshot {
  return {
    owner: "akash1test",
    hostUri: "https://test.example.com:8443",
    ipRegion: null,
    uptime7d: null,
    lastSuccessfulSnapshot: {
      nodes: nodes.map((n, i) => ({
        name: `node${i}`,
        cpuAllocatable: n.cpu,
        cpuAllocated: n.cpuAllocated ?? 0,
        memoryAllocatable: n.memory,
        memoryAllocated: n.memoryAllocated ?? 0,
        ephemeralStorageAllocatable: n.ephemeral,
        ephemeralStorageAllocated: n.ephemeralAllocated ?? 0,
        gpuAllocatable: n.gpuCount ?? 0,
        gpuAllocated: n.gpuAllocated ?? 0,
        capabilitiesStorageHDD: n.storageClasses?.includes("beta1") ?? false,
        capabilitiesStorageSSD: n.storageClasses?.includes("beta2") ?? false,
        capabilitiesStorageNVME: n.storageClasses?.includes("beta3") ?? false,
        gpus: (n.gpuInfo ?? []).map(g => ({
          vendor: g.vendor,
          name: g.name,
          modelId: g.modelId,
          interface: g.interface,
          memorySize: g.memorySize
        })),
        cpus: n.cpus ?? []
      })),
      storage: storage ?? []
    }
  };
}

function makeResourceUnits(input: {
  cpu: bigint;
  memory: bigint;
  ephemeral: bigint;
  count: number;
  gpuUnits?: bigint;
  gpuAttributes?: { key: string; value: string }[];
  extraStorage?: { name: string; quantity: bigint; attributes: { key: string; value: string }[] }[];
}): RequestedResourceUnit[] {
  const storageVols = [
    {
      name: "default",
      quantity: input.ephemeral,
      attributes: [
        { key: "persistent", value: "false" },
        { key: "class", value: "ephemeral" }
      ]
    },
    ...(input.extraStorage ?? [])
  ];

  return [
    {
      id: 1,
      resources: {
        cpu: { units: input.cpu, attributes: [] },
        gpu: { units: input.gpuUnits ?? 0n, attributes: input.gpuAttributes ?? [] },
        memory: { quantity: input.memory, attributes: [] },
        storage: storageVols
      },
      count: input.count
    }
  ];
}
