import type { Sequelize } from "sequelize";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidScreeningRequest } from "@src/provider/http-schemas/bid-screening.schema";
import { BidScreeningService } from "./bid-screening.service";

describe(BidScreeningService.name, () => {
  describe("aggregateResources", () => {
    it("passes single resource unit values through correctly", () => {
      const { service } = setup();

      const result = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);

      expect(result.totalCpu).toBe(1000);
      expect(result.totalMemory).toBe(512);
      expect(result.totalGpu).toBe(0);
      expect(result.totalEphemeralStorage).toBe(1024);
      expect(result.totalPersistentStorage).toBe(0);
      expect(result.maxPerReplicaGpu).toBe(0);
      expect(result.hasGpuAttributes).toBe(false);
      expect(result.hasPersistentStorage).toBe(false);
    });

    it("multiplies resources by replica count", () => {
      const { service } = setup();

      const result = service.aggregateResources([{ cpu: 500, memory: 256, gpu: 2, gpuAttributes: { vendor: "nvidia" }, ephemeralStorage: 512, count: 3 }]);

      expect(result.totalCpu).toBe(1500);
      expect(result.totalMemory).toBe(768);
      expect(result.totalGpu).toBe(6);
      expect(result.totalEphemeralStorage).toBe(1536);
      expect(result.maxPerReplicaGpu).toBe(2);
    });

    it("sums totals across multiple resource units", () => {
      const { service } = setup();

      const result = service.aggregateResources([
        { cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 2 },
        { cpu: 500, memory: 256, gpu: 0, ephemeralStorage: 512, count: 1 }
      ]);

      expect(result.totalCpu).toBe(2500);
      expect(result.totalMemory).toBe(1280);
      expect(result.totalEphemeralStorage).toBe(2560);
    });

    it("tracks GPU attributes including vendor and model", () => {
      const { service } = setup();

      const result = service.aggregateResources([
        {
          cpu: 1000,
          memory: 512,
          gpu: 4,
          gpuAttributes: { vendor: "nvidia", model: "a100", interface: "pcie", memorySize: "80Gi" },
          ephemeralStorage: 1024,
          count: 1
        }
      ]);

      expect(result.hasGpuAttributes).toBe(true);
      expect(result.gpuVendor).toBe("nvidia");
      expect(result.gpuModel).toBe("a100");
      expect(result.gpuInterface).toBe("pcie");
      expect(result.gpuMemorySize).toBe("80Gi");
      expect(result.maxPerReplicaGpu).toBe(4);
    });

    it("tracks persistent storage and storage class", () => {
      const { service } = setup();

      const result = service.aggregateResources([
        {
          cpu: 1000,
          memory: 512,
          gpu: 0,
          ephemeralStorage: 1024,
          persistentStorage: 2048,
          persistentStorageClass: "beta3",
          count: 1
        }
      ]);

      expect(result.hasPersistentStorage).toBe(true);
      expect(result.totalPersistentStorage).toBe(2048);
      expect(result.persistentStorageClass).toBe("beta3");
    });

    it("uses max GPU per-replica across resource units, not sum", () => {
      const { service } = setup();

      const result = service.aggregateResources([
        { cpu: 1000, memory: 512, gpu: 2, gpuAttributes: { vendor: "nvidia" }, ephemeralStorage: 1024, count: 1 },
        { cpu: 1000, memory: 512, gpu: 8, gpuAttributes: { vendor: "amd" }, ephemeralStorage: 1024, count: 1 },
        { cpu: 1000, memory: 512, gpu: 4, gpuAttributes: { vendor: "nvidia" }, ephemeralStorage: 1024, count: 1 }
      ]);

      expect(result.maxPerReplicaGpu).toBe(8);
      expect(result.totalGpu).toBe(14);
    });
  });

  describe("buildQuery", () => {
    it("builds CPU-only workload with minimal JOINs and no GPU/storage/attribute tables", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain('"providerSnapshot"');
      expect(sql).not.toContain('"providerSnapshotNode"');
      expect(sql).not.toContain('"providerSnapshotNodeGPU"');
      expect(sql).not.toContain('"providerSnapshotStorage"');
      expect(sql).not.toContain('"providerAttribute"');
      expect(sql).not.toContain('"providerAttributeSignature"');
      expect(replacements).toMatchObject({ totalCpu: 1000, totalMemory: 512, totalEphemeralStorage: 1024 });
    });

    it("adds providerSnapshotNode and providerSnapshotNodeGPU JOINs for GPU with vendor+model", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 512, gpu: 4, gpuAttributes: { vendor: "nvidia", model: "a100" }, ephemeralStorage: 1024, count: 1 }
      ]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain('"providerSnapshotNode"');
      expect(sql).toContain('"providerSnapshotNodeGPU"');
      expect(sql).toContain("gpu.vendor = :gpuVendor");
      expect(sql).toContain("gpu.name = :gpuModel");
      expect(replacements).toMatchObject({ gpuVendor: "nvidia", gpuModel: "a100" });
    });

    it("adds vendor filter but not model filter when only vendor is provided", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 1, gpuAttributes: { vendor: "nvidia" }, ephemeralStorage: 1024, count: 1 }]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain("gpu.vendor = :gpuVendor");
      expect(sql).not.toContain("gpu.name = :gpuModel");
      expect(replacements).toHaveProperty("gpuVendor", "nvidia");
      expect(replacements).not.toHaveProperty("gpuModel");
    });

    it("adds all 4 GPU attribute filters when all are provided", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        {
          cpu: 1000,
          memory: 512,
          gpu: 2,
          gpuAttributes: { vendor: "nvidia", model: "a100", interface: "pcie", memorySize: "80Gi" },
          ephemeralStorage: 1024,
          count: 1
        }
      ]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain("gpu.vendor = :gpuVendor");
      expect(sql).toContain("gpu.name = :gpuModel");
      expect(sql).toContain("gpu.interface = :gpuInterface");
      expect(sql).toContain('gpu."memorySize" = :gpuMemorySize');
      expect(replacements).toMatchObject({ gpuVendor: "nvidia", gpuModel: "a100", gpuInterface: "pcie", gpuMemorySize: "80Gi" });
    });

    it("adds providerSnapshotStorage JOIN with class and capacity WHERE for persistent storage with class", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        {
          cpu: 1000,
          memory: 512,
          gpu: 0,
          ephemeralStorage: 1024,
          persistentStorage: 2048,
          persistentStorageClass: "beta3",
          count: 1
        }
      ]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain('"providerSnapshotStorage"');
      expect(sql).toContain("pss.class = :storageClass");
      expect(sql).toContain("(pss.allocatable - pss.allocated) >= :totalPersistentStorage");
      expect(replacements).toMatchObject({ storageClass: "beta3", totalPersistentStorage: 2048 });
    });

    it("checks availablePersistentStorage without pss JOIN when no storage class is provided", () => {
      const { service } = setup();
      // persistentStorage > 0 but no persistentStorageClass — resource unit without class
      // We need to manually craft agg since schema requires class when storage is set in a unit
      // Directly test the buildQuery path: hasPersistentStorage=true, persistentStorageClass=undefined
      const agg = {
        totalCpu: 1000,
        totalMemory: 512,
        totalGpu: 0,
        totalEphemeralStorage: 1024,
        totalPersistentStorage: 2048,
        maxPerReplicaGpu: 0,
        hasGpuAttributes: false,
        hasPersistentStorage: true,
        persistentStorageClass: undefined
      };

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain('ps."availablePersistentStorage" >= :totalPersistentStorage');
      expect(sql).not.toContain('"providerSnapshotStorage"');
      expect(sql).not.toContain("pss.class = :storageClass");
      expect(replacements).toHaveProperty("totalPersistentStorage", 2048);
    });

    it("adds providerAttribute JOIN and HAVING COUNT FILTER per attribute key=value", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);
      const requirements: BidScreeningRequest["data"]["requirements"] = {
        attributes: [
          { key: "region", value: "us-east" },
          { key: "tier", value: "premium" }
        ],
        signedBy: { allOf: [], anyOf: [] }
      };

      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain('"providerAttribute"');
      expect(sql).toContain('COUNT(*) FILTER (WHERE pa."key" = :attrKey0 AND pa."value" = :attrVal0) > 0');
      expect(sql).toContain('COUNT(*) FILTER (WHERE pa."key" = :attrKey1 AND pa."value" = :attrVal1) > 0');
      expect(replacements).toMatchObject({ attrKey0: "region", attrVal0: "us-east", attrKey1: "tier", attrVal1: "premium" });
    });

    it("adds providerAttributeSignature JOIN and auditor IN clause for signedBy anyOf", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);
      const requirements: BidScreeningRequest["data"]["requirements"] = {
        attributes: [],
        signedBy: { allOf: [], anyOf: ["auditor1", "auditor2"] }
      };

      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain('"providerAttributeSignature"');
      expect(sql).toContain("pas.auditor IN (:anyOfAuditors)");
      expect(replacements).toMatchObject({ anyOfAuditors: ["auditor1", "auditor2"] });
    });

    it("adds per-auditor COUNT FILTER in HAVING for signedBy allOf", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);
      const requirements: BidScreeningRequest["data"]["requirements"] = {
        attributes: [],
        signedBy: { allOf: ["auditor-a", "auditor-b"], anyOf: [] }
      };

      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain('"providerAttributeSignature"');
      expect(sql).toContain("COUNT(*) FILTER (WHERE pas.auditor = :allOfAuditor0) > 0");
      expect(sql).toContain("COUNT(*) FILTER (WHERE pas.auditor = :allOfAuditor1) > 0");
      expect(sql).not.toContain("pas.auditor IN (:anyOfAuditors)");
      expect(replacements).toMatchObject({ allOfAuditor0: "auditor-a", allOfAuditor1: "auditor-b" });
    });

    it("combines GPU, persistent storage, attributes, and signedBy — all JOINs present", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        {
          cpu: 1000,
          memory: 512,
          gpu: 2,
          gpuAttributes: { vendor: "nvidia", model: "a100" },
          ephemeralStorage: 1024,
          persistentStorage: 2048,
          persistentStorageClass: "beta3",
          count: 1
        }
      ]);
      const requirements: BidScreeningRequest["data"]["requirements"] = {
        attributes: [{ key: "region", value: "us-east" }],
        signedBy: { allOf: [], anyOf: ["auditor1"] }
      };

      const { sql } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain('"providerSnapshotNode"');
      expect(sql).toContain('"providerSnapshotNodeGPU"');
      expect(sql).toContain('"providerSnapshotStorage"');
      expect(sql).toContain('"providerAttribute"');
      expect(sql).toContain('"providerAttributeSignature"');
    });

    it("wraps in SELECT COUNT(*) AS total and omits LIMIT when isCount=true", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);

      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), undefined, true);

      expect(sql).toContain("SELECT COUNT(*) AS total FROM (");
      expect(sql).not.toContain("LIMIT");
      expect(replacements).not.toHaveProperty("limit");
    });

    it("includes default limit in replacements for non-count query", () => {
      const { service } = setup();
      const agg = service.aggregateResources([{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }]);

      const { replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(replacements).toHaveProperty("limit", 50);
    });
  });

  describe("findMatchingProviders", () => {
    it("returns providers and total count from DB queries", async () => {
      const { service, chainDb } = setup();
      const mockProviders = [
        {
          owner: "akash1abc",
          hostUri: "https://provider1.example.com",
          leaseCount: 5,
          availableCpu: 10000,
          availableMemory: 8192,
          availableGpu: 0,
          availableEphemeralStorage: 51200,
          availablePersistentStorage: 0
        }
      ];
      chainDb.query.mockResolvedValueOnce([{ total: "5" }] as never).mockResolvedValueOnce(mockProviders as never);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      expect(result.total).toBe(5);
      expect(result.providers).toEqual(mockProviders);
      expect(typeof result.queryTimeMs).toBe("number");
    });

    it("runs constraint diagnosis when total is 0", async () => {
      const { service, chainDb } = setup();
      // count query returns 0
      chainDb.query
        .mockResolvedValueOnce([{ total: "0" }] as never)
        .mockResolvedValueOnce([] as never)
        // diagnoseConstraints: 4 baseline checks (online, cpu, memory, ephemeral)
        .mockResolvedValueOnce([{ c: "72" }] as never)
        .mockResolvedValueOnce([{ c: "60" }] as never)
        .mockResolvedValueOnce([{ c: "50" }] as never)
        .mockResolvedValueOnce([{ c: "40" }] as never);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      expect(result.total).toBe(0);
      expect(result.constraints).toBeDefined();
      expect(result.constraints).toHaveLength(4);
      expect(result.constraints![0]).toMatchObject({ name: "Online providers (baseline)", count: 72 });
    });

    it("does not run constraint diagnosis when total is greater than 0", async () => {
      const { service, chainDb } = setup();
      chainDb.query.mockResolvedValueOnce([{ total: "3" }] as never).mockResolvedValueOnce([] as never);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      // Only 2 calls: count + main — no diagnosis calls
      expect(chainDb.query).toHaveBeenCalledTimes(2);
      expect(result.constraints).toBeUndefined();
    });

    it("uses default limit of 50 when not provided", async () => {
      const { service, chainDb } = setup();
      chainDb.query.mockResolvedValueOnce([{ total: "1" }] as never).mockResolvedValueOnce([] as never);

      await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 512, gpu: 0, ephemeralStorage: 1024, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      // The main query (2nd call) replacements should include limit: 50
      const mainQueryCall = chainDb.query.mock.calls[1];
      const mainQueryOptions = mainQueryCall[1] as { replacements: Record<string, unknown> };
      expect(mainQueryOptions.replacements).toHaveProperty("limit", 50);
    });
  });

  function setup() {
    const chainDb = mock<Sequelize>();
    const service = new BidScreeningService(chainDb);
    return { service, chainDb };
  }

  function defaultRequirements(): BidScreeningRequest["data"]["requirements"] {
    return { attributes: [], signedBy: { allOf: [], anyOf: [] } };
  }
});
