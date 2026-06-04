import { describe, expect, it } from "vitest";

import { parseGPUAttributes } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import { getAttributeFingerprint } from "@src/mappers/groupspec-mapper/groupspec-mapper";
import { parseStorageAttributes } from "@src/mappers/storage-attribute-parser/storage-attribute-parser";
import type { ClusterState, CpuInfo, GpuInfo, NodeState, RequestedResourceUnit, ResourceAttribute } from "../../types/inventory";
import { ClusterInventoryMatcherService } from "./cluster-inventory-matcher.service";

describe(ClusterInventoryMatcherService.name, () => {
  describe("basic resource matching (US1)", () => {
    it("matches when single node has sufficient resources", () => {
      const { service, cluster, resourceUnits } = setup({});
      const result = service.match(cluster, resourceUnits);
      expect(result.matched).toBe(true);
    });

    it("fails when single node has insufficient CPU", () => {
      const { service, cluster, resourceUnits } = setup({ requestedCpu: 20000n });
      const result = service.match(cluster, resourceUnits);
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("fails when single node has insufficient memory", () => {
      const { service, cluster, resourceUnits } = setup({ requestedMemory: 999999999999n });
      const result = service.match(cluster, resourceUnits);
      expect(result.matched).toBe(false);
    });

    it("spreads replicas across multiple nodes when single node is insufficient", () => {
      const { service } = setup({});
      const cluster = makeCluster([
        { cpu: 4000n, memory: 8589934592n, ephemeral: 10737418240n },
        { cpu: 4000n, memory: 8589934592n, ephemeral: 10737418240n }
      ]);
      const units = makeResourceUnits({ cpu: 3000n, memory: 4294967296n, ephemeral: 5368709120n, count: 2 });

      const result = service.match(cluster, units);
      expect(result.matched).toBe(true);
    });

    it("places all replicas on one node when possible", () => {
      const { service } = setup({});
      const cluster = makeCluster([{ cpu: 16000n, memory: 34359738368n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 4 });

      const result = service.match(cluster, units);
      expect(result.matched).toBe(true);
    });

    it("fails when cluster has zero nodes", () => {
      const { service } = setup({});
      const cluster = makeCluster([]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      const result = service.match(cluster, units);
      expect(result.matched).toBe(false);
    });
  });

  describe("storage matching (US3)", () => {
    it("deducts ephemeral storage from node", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, ephemeral: 10737418240n }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("deducts RAM-backed storage from node memory", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }]);
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails RAM-backed storage when combined with memory exceeds node capacity", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 10737418240n, ephemeral: 107374182400n }]);
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("deducts persistent storage from cluster pool", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster(
        [{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n, storageClasses: ["beta2"] }],
        [{ class: "beta2", allocatable: 536870912000n, allocated: 0n }]
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails when node lacks storage class capability", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster(
        [{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n, storageClasses: ["beta1"] }],
        [{ class: "beta2", allocatable: 536870912000n, allocated: 0n }]
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("fails when cluster pool is exhausted", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster(
        [{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n, storageClasses: ["beta2"] }],
        [{ class: "beta2", allocatable: 1073741824n, allocated: 0n }]
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

      expect(service.match(cluster, units).matched).toBe(false);
    });
  });

  describe("GPU matching (US2)", () => {
    it("matches exact GPU vendor and model", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("matches wildcard model against any GPU model", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("filters by RAM size", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("filters by interface with sxm normalization", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails when no GPU matches on node", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("passes when zero GPUs are requested", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1, gpuUnits: 0n });

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails when requesting 2 A100s but node has 1 A100 + 1 V100", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("pins to first GPU type when no GPU specs provided", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails GPU request when node has no GPU info", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("rejects wildcard request for 2 GPUs when node has mixed RAM variants of the same model", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("rejects wildcard request for 2 GPUs when node has mixed interfaces of the same model", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("matches wildcard request for 2 GPUs when node has identical SKUs", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });
  });

  describe("multi-group matching (US5)", () => {
    it("matches two groups spread across nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n },
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }
      ]);
      const cpuGroup = buildResourceUnit({
        id: 1,
        cpu: 4000n,
        memory: 8589934592n,
        storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 2
      });
      const gpuGroup = buildResourceUnit({
        id: 2,
        cpu: 2000n,
        memory: 4294967296n,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }],
        storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });

      const result = service.match(cluster, [cpuGroup, gpuGroup]);
      expect(result.matched).toBe(false);
    });

    it("places mixed CPU+GPU groups on appropriate nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        { cpu: 16000n, memory: 34359738368n, ephemeral: 107374182400n }
      ]);

      const cpuGroup = buildResourceUnit({
        id: 1,
        cpu: 2000n,
        memory: 4294967296n,
        storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 4
      });

      const result = service.match(cluster, [cpuGroup]);
      expect(result.matched).toBe(true);
    });

    it("fails entire cluster when one group has insufficient capacity", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 4000n, memory: 8589934592n, ephemeral: 107374182400n }]);

      const smallGroup = buildResourceUnit({
        id: 1,
        cpu: 1000n,
        memory: 1073741824n,
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });
      const largeGroup = buildResourceUnit({
        id: 2,
        cpu: 10000n,
        memory: 1073741824n,
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });

      const result = service.match(cluster, [smallGroup, largeGroup]);
      expect(result.matched).toBe(false);
    });

    it("handles all groups placed successfully on a large node", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 32000n, memory: 68719476736n, ephemeral: 536870912000n }]);

      const group1 = buildResourceUnit({
        id: 1,
        cpu: 4000n,
        memory: 8589934592n,
        storage: [{ name: "default", quantity: 10737418240n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 2
      });
      const group2 = buildResourceUnit({
        id: 2,
        cpu: 2000n,
        memory: 4294967296n,
        storage: [{ name: "default", quantity: 5368709120n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 3
      });

      const result = service.match(cluster, [group1, group2]);
      expect(result.matched).toBe(true);
    });
  });

  describe("replica GPU consistency invariant (US5)", () => {
    it("passes when all replicas with wildcard model land on nodes with the same GPU model", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails when a later replica would resolve to a different GPU model than the first (wildcard)", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("fails when a later replica on another node has a different RAM size than the first (wildcard)", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        },
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });
  });

  describe("cross-service canonical scope (AC9)", () => {
    it("places two services with disjoint GPU model requests independently in the same placement group", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        },
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "h100", modelId: "2330", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const serviceA = buildResourceUnit({
        id: 1,
        cpu: 1000n,
        memory: 1073741824n,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }],
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });
      const serviceB = buildResourceUnit({
        id: 2,
        cpu: 1000n,
        memory: 1073741824n,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/h100", value: "true" }],
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });

      expect(service.match(cluster, [serviceA, serviceB]).matched).toBe(true);
    });

    it("does not leak a wildcard-pinned GPU model from one service to another in the same placement group", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        },
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "h100", modelId: "2330", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const wildcardService = buildResourceUnit({
        id: 1,
        cpu: 1000n,
        memory: 1073741824n,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia", value: "true" }],
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });
      const h100Service = buildResourceUnit({
        id: 2,
        cpu: 1000n,
        memory: 1073741824n,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/h100", value: "true" }],
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });

      expect(service.match(cluster, [wildcardService, h100Service]).matched).toBe(true);
    });

    it("places two services with different non-empty CPU fingerprints independently", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n },
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }
      ]);
      const intelService = buildResourceUnit({
        id: 1,
        cpu: 1000n,
        cpuAttributes: [{ key: "vendor", value: "intel" }],
        memory: 1073741824n,
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });
      const amdService = buildResourceUnit({
        id: 2,
        cpu: 1000n,
        cpuAttributes: [{ key: "vendor", value: "amd" }],
        memory: 1073741824n,
        storage: [{ name: "default", quantity: 1073741824n, attributes: [{ key: "persistent", value: "false" }] }],
        count: 1
      });

      const result = service.match(cluster, [intelService, amdService]);
      expect(result.matched).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns INSUFFICIENT_CAPACITY (not GROUP_RESOURCE_MISMATCH) when a wildcard-pinned replica cannot find a second matching GPU within the same service", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "a100", modelId: "2235", interface: "PCIe", memorySize: "80Gi" }]
        },
        {
          cpu: 8000n,
          memory: 17179869184n,
          ephemeral: 107374182400n,
          gpuCount: 1n,
          gpuInfo: [{ vendor: "nvidia", name: "h100", modelId: "2330", interface: "PCIe", memorySize: "80Gi" }]
        }
      ]);
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 1073741824n,
        count: 2,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia", value: "true" }]
      });

      const result = service.match(cluster, units);
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });
  });

  describe("nodes with existing allocations", () => {
    it("matches when remaining capacity after allocation is sufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, cpuAllocated: 3000n, memory: 17179869184n, memoryAllocated: 4294967296n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 8589934592n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("fails when CPU remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, cpuAllocated: 5000n, memory: 17179869184n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("fails when memory remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, memoryAllocated: 14000000000n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 8589934592n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("fails when ephemeral storage remaining after allocation is insufficient", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n, ephemeralAllocated: 105000000000n }]);
      const units = makeResourceUnits({ cpu: 1000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(false);
    });

    it("matches at exact remaining boundary", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 8000n, cpuAllocated: 4000n, memory: 17179869184n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 4000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("spreads replicas across nodes with varying allocations", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        { cpu: 8000n, cpuAllocated: 4000n, memory: 17179869184n, ephemeral: 107374182400n },
        { cpu: 8000n, cpuAllocated: 4000n, memory: 17179869184n, ephemeral: 107374182400n }
      ]);
      const units = makeResourceUnits({ cpu: 3000n, memory: 1073741824n, ephemeral: 5368709120n, count: 2 });

      expect(service.match(cluster, units).matched).toBe(true);
    });

    it("accounts for GPU allocation on nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        {
          cpu: 16000n,
          memory: 34359738368n,
          ephemeral: 107374182400n,
          gpuCount: 2n,
          gpuAllocated: 1n,
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

      expect(service.match(cluster, units).matched).toBe(false);
    });
  });

  describe("boundary-value precision (4-node topology)", () => {
    const MEM_16GI = 17179869184n;
    const STORAGE_8GI = 8589934592n;

    function makeFourNodeCluster() {
      return makeCluster([
        {
          cpu: 119800n,
          cpuAllocated: 51020n,
          memory: 457317732352n,
          memoryAllocated: 17495527424n,
          ephemeral: 7760751097705n,
          ephemeralAllocated: 8589934592n
        },
        {
          cpu: 119800n,
          cpuAllocated: 51000n,
          memory: 457317732352n,
          memoryAllocated: 17495527424n,
          ephemeral: 7760751097705n,
          ephemeralAllocated: 8589934592n,
          gpuCount: 2n,
          gpuInfo: [
            { vendor: "nvidia", name: "a100", modelId: "20b5", interface: "PCIe", memorySize: "80Gi" },
            { vendor: "nvidia", name: "a100", modelId: "20b5", interface: "PCIe", memorySize: "80Gi" }
          ]
        },
        {
          cpu: 119800n,
          cpuAllocated: 275n,
          memory: 457317732352n,
          memoryAllocated: 17495527424n,
          ephemeral: 7760751097705n,
          ephemeralAllocated: 0n
        },
        {
          cpu: 119800n,
          cpuAllocated: 305n,
          memory: 457317732352n,
          memoryAllocated: 17495527424n,
          ephemeral: 7760751097705n,
          ephemeralAllocated: 0n
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
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(100000n, 0n, 2)).matched).toBe(true);
    });

    it("places 68780 CPU x 4 replicas across all four nodes", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(68780n, 0n, 4)).matched).toBe(true);
    });

    it("places 68800 CPU x 3 replicas skipping node 0", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(68800n, 0n, 3)).matched).toBe(true);
    });

    it("places 119495 CPU x 2 replicas on nodes 2 and 3", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(119495n, 0n, 2)).matched).toBe(true);
    });

    it("places 68780 CPU x 1 replica on node 0 at exact boundary", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(68780n, 0n, 1)).matched).toBe(true);
    });

    it("places 68780 CPU + 1 GPU x 1 replica on GPU node", () => {
      const service = new ClusterInventoryMatcherService();
      expect(service.match(makeFourNodeCluster(), makeFourNodeUnits(68780n, 1n, 1)).matched).toBe(true);
    });

    it("places multi-group reservation (CPU-only + GPU) across nodes", () => {
      const service = new ClusterInventoryMatcherService();
      const cpuGroup = buildResourceUnit({
        id: 1,
        cpu: 68700n,
        memory: MEM_16GI,
        storage: [
          {
            name: "default",
            quantity: STORAGE_8GI,
            attributes: [
              { key: "persistent", value: "false" },
              { key: "class", value: "ephemeral" }
            ]
          }
        ],
        count: 1
      });
      const gpuGroup = buildResourceUnit({
        id: 2,
        cpu: 68700n,
        memory: MEM_16GI,
        gpuUnits: 1n,
        gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }],
        storage: [
          {
            name: "default",
            quantity: STORAGE_8GI,
            attributes: [
              { key: "persistent", value: "false" },
              { key: "class", value: "ephemeral" }
            ]
          }
        ],
        count: 1
      });

      expect(service.match(makeFourNodeCluster(), [cpuGroup, gpuGroup]).matched).toBe(true);
    });

    it("rejects 70000 CPU x 4 replicas (only 2 nodes large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeCluster(), makeFourNodeUnits(70000n, 0n, 4));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("rejects 100000 CPU x 3 replicas (only 2 nodes large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeCluster(), makeFourNodeUnits(100000n, 0n, 3));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });

    it("rejects 119525 CPU x 2 replicas (only 1 node large enough)", () => {
      const service = new ClusterInventoryMatcherService();
      const result = service.match(makeFourNodeCluster(), makeFourNodeUnits(119525n, 0n, 2));
      expect(result.matched).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_CAPACITY");
    });
  });

  describe("input immutability", () => {
    it("does not mutate the cluster argument on a successful match", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster(
        [
          { cpu: 16000n, memory: 34359738368n, ephemeral: 107374182400n, storageClasses: ["beta2"] },
          { cpu: 16000n, memory: 34359738368n, ephemeral: 107374182400n, storageClasses: ["beta2"] }
        ],
        [{ class: "beta2", allocatable: 536870912000n, allocated: 0n }]
      );
      const units = makeResourceUnits({
        cpu: 1000n,
        memory: 1073741824n,
        ephemeral: 5368709120n,
        count: 2,
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
      const snapshot = snapshotCluster(cluster);

      const result = service.match(cluster, units);

      expect(result.matched).toBe(true);
      expect(snapshotCluster(cluster)).toEqual(snapshot);
    });

    it("does not mutate the cluster argument on a failed match", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([{ cpu: 4000n, memory: 8589934592n, ephemeral: 107374182400n }]);
      const units = makeResourceUnits({ cpu: 10000n, memory: 1073741824n, ephemeral: 5368709120n, count: 1 });
      const snapshot = snapshotCluster(cluster);

      const result = service.match(cluster, units);

      expect(result.matched).toBe(false);
      expect(snapshotCluster(cluster)).toEqual(snapshot);
    });

    it("produces identical results when called twice on the same cluster instance", () => {
      const service = new ClusterInventoryMatcherService();
      const cluster = makeCluster([
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n },
        { cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }
      ]);
      const units = makeResourceUnits({ cpu: 3000n, memory: 4294967296n, ephemeral: 5368709120n, count: 2 });

      const first = service.match(cluster, units);
      const second = service.match(cluster, units);

      expect(first).toEqual(second);
      expect(first.matched).toBe(true);
    });
  });

  function setup(input: { requestedCpu?: bigint; requestedMemory?: bigint }) {
    const service = new ClusterInventoryMatcherService();
    const cluster = makeCluster([{ cpu: 8000n, memory: 17179869184n, ephemeral: 107374182400n }]);
    const resourceUnits = makeResourceUnits({
      cpu: input.requestedCpu ?? 1000n,
      memory: input.requestedMemory ?? 1073741824n,
      ephemeral: 5368709120n,
      count: 1
    });
    return { service, cluster, resourceUnits };
  }
});

function makeCluster(
  nodes: {
    cpu: bigint;
    memory: bigint;
    ephemeral: bigint;
    cpuAllocated?: bigint;
    memoryAllocated?: bigint;
    ephemeralAllocated?: bigint;
    gpuCount?: bigint;
    gpuAllocated?: bigint;
    gpuInfo?: GpuInfo[];
    storageClasses?: string[];
    cpus?: CpuInfo[];
  }[],
  storage?: { class: string; allocatable: bigint; allocated: bigint }[]
): ClusterState {
  const storageMap: NonNullable<ClusterState["storage"]> = Object.create(null);
  for (const pool of storage ?? []) {
    storageMap[pool.class] = { class: pool.class, quantity: { allocatable: pool.allocatable, allocated: pool.allocated } };
  }

  const stateNodes: NodeState[] = nodes.map((n, i) => ({
    name: `node${i}`,
    cpu: { allocatable: n.cpu, allocated: n.cpuAllocated ?? 0n },
    memory: { allocatable: n.memory, allocated: n.memoryAllocated ?? 0n },
    ephemeralStorage: { allocatable: n.ephemeral, allocated: n.ephemeralAllocated ?? 0n },
    gpu: {
      quantity: { allocatable: n.gpuCount ?? 0n, allocated: n.gpuAllocated ?? 0n },
      info: n.gpuInfo ?? []
    },
    storageClasses: n.storageClasses ?? [],
    cpus: n.cpus ?? []
  }));

  return { nodes: stateNodes, storage: storageMap };
}

function snapshotCluster(cluster: ClusterState) {
  return {
    nodes: (cluster.nodes ?? []).map(n => ({
      name: n.name,
      cpu: { allocatable: n.cpu.allocatable, allocated: n.cpu.allocated },
      memory: { allocatable: n.memory.allocatable, allocated: n.memory.allocated },
      ephemeralStorage: { allocatable: n.ephemeralStorage.allocatable, allocated: n.ephemeralStorage.allocated },
      gpu: {
        quantity: { allocatable: n.gpu.quantity.allocatable, allocated: n.gpu.quantity.allocated },
        info: n.gpu.info.map(g => ({ ...g }))
      },
      storageClasses: [...n.storageClasses],
      cpus: n.cpus.map(c => ({ ...c }))
    })),
    storage: Object.fromEntries(
      Object.entries(cluster.storage ?? {}).map(([k, v]) => [
        k,
        { class: v.class, quantity: { allocatable: v.quantity.allocatable, allocated: v.quantity.allocated } }
      ])
    )
  };
}

function makeResourceUnits(input: {
  cpu: bigint;
  memory: bigint;
  ephemeral: bigint;
  count: number;
  gpuUnits?: bigint;
  gpuAttributes?: ResourceAttribute[];
  extraStorage?: { name: string; quantity: bigint; attributes: ResourceAttribute[] }[];
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
    buildResourceUnit({
      id: 1,
      cpu: input.cpu,
      memory: input.memory,
      gpuUnits: input.gpuUnits,
      gpuAttributes: input.gpuAttributes,
      storage: storageVols,
      count: input.count
    })
  ];
}

function buildResourceUnit(input: {
  id: number;
  cpu: bigint;
  cpuAttributes?: ResourceAttribute[];
  memory: bigint;
  gpuUnits?: bigint;
  gpuAttributes?: ResourceAttribute[];
  storage: { name: string; quantity: bigint; attributes: ResourceAttribute[] }[];
  count: number;
}): RequestedResourceUnit {
  return {
    id: input.id,
    resources: {
      cpu: { units: input.cpu, fingerprint: getAttributeFingerprint(input.cpuAttributes) },
      gpu: { units: input.gpuUnits ?? 0n, attributes: parseGPUAttributes(input.gpuAttributes ?? []) },
      memory: { quantity: input.memory },
      storage: input.storage.map(s => ({ name: s.name, quantity: s.quantity, attributes: parseStorageAttributes(s.attributes) }))
    },
    count: input.count
  };
}
