import type postgres from "postgres";
import { container, Lifecycle } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import type { EnvConfig } from "@src/config/env.config";
import type { ResourceAggregates } from "@src/lib/resource-aggregator/resource-aggregator";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import { BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import type { Inventory } from "@src/types/inventory";

import { testDb } from "@test/setup-integration-tests";

const AUDITOR = "akash1auditor";

describe(BidScreeningRepository.name, () => {
  beforeEach(async () => {
    await testDb.truncate();
  });

  describe("online filter", () => {
    it("returns only providers with is_online = true and is_online_since IS NOT NULL", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "online-with-since", isOnline: true, isOnlineSince: new Date() });
      await seedProvider({ owner: "online-no-since", isOnline: true, isOnlineSince: null });
      await seedProvider({ owner: "offline", isOnline: false, isOnlineSince: new Date() });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), {}));

      expect(owners).toEqual(new Set(["online-with-since"]));
    });
  });

  describe("aggregate prefilter", () => {
    it("excludes providers below totalCpu/Memory/Gpu/Eph/Persistent aggregate thresholds", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "rich",
        totalAvailableCpu: 10000n,
        totalAvailableMemory: 20000n,
        totalAvailableGpu: 10n,
        totalAvailableEph: 30000n,
        totalAvailablePersistent: 40000n
      });
      await seedProvider({ owner: "tiny", totalAvailableCpu: 100n });

      const owners = await ownerSetFrom(
        repository.findCandidates(
          makeAggregates({ totalCpu: 1000n, totalMemory: 1000n, totalGpu: 1n, totalEphemeralStorage: 1000n, totalPersistentStorage: 1000n }),
          {}
        )
      );

      expect(owners).toEqual(new Set(["rich"]));
    });

    it("excludes providers whose max-node-free is below per-replica requirement", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "big-node", maxNodeFreeCpu: 8000n, maxNodeFreeMemory: 8000n, maxNodeFreeGpu: 2n, totalAvailableCpu: 8000n });
      await seedProvider({
        owner: "many-small-nodes",
        maxNodeFreeCpu: 1000n,
        maxNodeFreeMemory: 1000n,
        maxNodeFreeGpu: 0n,
        totalAvailableCpu: 100000n
      });

      const owners = await ownerSetFrom(
        repository.findCandidates(makeAggregates({ maxPerReplicaCpu: 4000n, maxPerReplicaMemory: 4000n, maxPerReplicaGpu: 1n }), {})
      );

      expect(owners).toEqual(new Set(["big-node"]));
    });
  });

  describe("GPU vendor and model filter", () => {
    it("matches an exact vendor/model entry in gpu_models", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "has-a100", gpuModels: ["nvidia/a100"], totalAvailableGpu: 1n, maxNodeFreeGpu: 1n });
      await seedProvider({ owner: "has-v100", gpuModels: ["nvidia/v100"], totalAvailableGpu: 1n, maxNodeFreeGpu: 1n });

      const owners = await ownerSetFrom(
        repository.findCandidates(makeAggregates({ gpuVendor: "nvidia", gpuModel: "a100", totalGpu: 1n, maxPerReplicaGpu: 1n }), {})
      );

      expect(owners).toEqual(new Set(["has-a100"]));
    });

    it("matches any vendor-prefixed entry when model is omitted (wildcard)", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "nvidia-a100", gpuModels: ["nvidia/a100"], totalAvailableGpu: 1n, maxNodeFreeGpu: 1n });
      await seedProvider({ owner: "nvidia-v100", gpuModels: ["nvidia/v100"], totalAvailableGpu: 1n, maxNodeFreeGpu: 1n });
      await seedProvider({ owner: "amd-mi300", gpuModels: ["amd/mi300x"], totalAvailableGpu: 1n, maxNodeFreeGpu: 1n });

      const owners = await ownerSetFrom(repository.findCandidates(makeAggregates({ gpuVendor: "nvidia", totalGpu: 1n, maxPerReplicaGpu: 1n }), {}));

      expect(owners).toEqual(new Set(["nvidia-a100", "nvidia-v100"]));
    });
  });

  describe("persistent storage class filter", () => {
    it("requires the storage_classes array to contain the requested class", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "has-beta2", storageClasses: ["beta2"], totalAvailablePersistent: 100n });
      await seedProvider({ owner: "has-beta3", storageClasses: ["beta3"], totalAvailablePersistent: 100n });

      const owners = await ownerSetFrom(repository.findCandidates(makeAggregates({ persistentStorageClass: "beta2", totalPersistentStorage: 1n }), {}));

      expect(owners).toEqual(new Set(["has-beta2"]));
    });
  });

  describe("self attribute filters", () => {
    it("supports exact self-attribute matches with jsonb containment", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "us-east", selfAttributes: [{ key: "region", value: "us-east" }] });
      await seedProvider({ owner: "eu-west", selfAttributes: [{ key: "region", value: "eu-west" }] });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), { attributes: [{ key: "region", value: "us-east" }] }));

      expect(owners).toEqual(new Set(["us-east"]));
    });

    it("supports glob self-attribute matches via regex", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "us-east", selfAttributes: [{ key: "region", value: "us-east-1" }] });
      await seedProvider({ owner: "us-west", selfAttributes: [{ key: "region", value: "us-west-2" }] });
      await seedProvider({ owner: "eu-west", selfAttributes: [{ key: "region", value: "eu-west-1" }] });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), { attributes: [{ key: "region", value: "us-*" }] }));

      expect(owners).toEqual(new Set(["us-east", "us-west"]));
    });

    it("respects key when matching glob — different keys with matching values are excluded", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "matching-key", selfAttributes: [{ key: "region", value: "us-east" }] });
      await seedProvider({ owner: "wrong-key", selfAttributes: [{ key: "tier", value: "us-east" }] });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), { attributes: [{ key: "region", value: "us-*" }] }));

      expect(owners).toEqual(new Set(["matching-key"]));
    });
  });

  describe("signedBy filter", () => {
    it("any-of: returns providers signed by at least one listed auditor", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "by-a", auditedBy: ["auditor-a"] });
      await seedProvider({ owner: "by-b", auditedBy: ["auditor-b"] });
      await seedProvider({ owner: "by-c", auditedBy: ["auditor-c"] });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), { signedBy: { anyOf: ["auditor-a", "auditor-b"] } }));

      expect(owners).toEqual(new Set(["by-a", "by-b"]));
    });

    it("all-of: returns providers signed by every listed auditor", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "by-both", auditedBy: ["auditor-a", "auditor-b"] });
      await seedProvider({ owner: "by-a-only", auditedBy: ["auditor-a"] });

      const owners = await ownerSetFrom(repository.findCandidates(zeroAggregates(), { signedBy: { allOf: ["auditor-a", "auditor-b"] } }));

      expect(owners).toEqual(new Set(["by-both"]));
    });
  });

  describe("is_audited projection", () => {
    it("sets is_audited=true when audited_by contains the configured AUDITOR_ADDRESS", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "audited", auditedBy: [AUDITOR] });
      await seedProvider({ owner: "not-audited", auditedBy: ["other-auditor"] });

      const candidates = await repository.findCandidates(zeroAggregates(), {});
      const byOwner = new Map(candidates.map(c => [c.owner, c]));

      expect(byOwner.get("audited")?.isAudited).toBe(true);
      expect(byOwner.get("not-audited")?.isAudited).toBe(false);
    });
  });

  describe("inventory hydration", () => {
    it("hydrates per-node CPU/memory/eph from the inventory JSONB into ProviderWithSnapshot shape", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "p",
        inventory: {
          nodes: [
            {
              name: "n1",
              cpu: { available: 4000 },
              memory: { available: 8589934592 },
              ephStorage: { available: 107374182400 },
              gpu: [],
              persistentStorage: []
            }
          ],
          storage: []
        }
      });

      const [candidate] = await repository.findCandidates(zeroAggregates(), {});

      expect(candidate.lastSuccessfulSnapshot.nodes[0]).toMatchObject({
        name: "n1",
        cpuAllocatable: 4000,
        cpuAllocated: 0,
        memoryAllocatable: 8589934592,
        memoryAllocated: 0,
        ephemeralStorageAllocatable: 107374182400,
        ephemeralStorageAllocated: 0,
        gpuAllocatable: 0,
        gpuAllocated: 0
      });
    });

    it("expands per-node gpu entries into one gpu info record per available unit and sums gpuAllocatable", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "p",
        inventory: {
          nodes: [
            {
              name: "n1",
              cpu: { available: 4000 },
              memory: { available: 100 },
              ephStorage: { available: 100 },
              gpu: [
                { vendor: "nvidia", model: "a100", available: 2, memorySize: "80Gi", interface: "PCIe", modelId: "20b5" },
                { vendor: "nvidia", model: "v100", available: 1, memorySize: "32Gi", interface: "PCIe", modelId: "1db4" }
              ],
              persistentStorage: []
            }
          ],
          storage: []
        }
      });

      const [candidate] = await repository.findCandidates(zeroAggregates(), {});
      const node = candidate.lastSuccessfulSnapshot.nodes[0];

      expect(node.gpuAllocatable).toBe(3);
      expect(node.gpus).toHaveLength(3);
      expect(node.gpus.filter(g => g.name === "a100")).toHaveLength(2);
      expect(node.gpus.filter(g => g.name === "v100")).toHaveLength(1);

      const a100 = node.gpus.find(g => g.name === "a100")!;
      expect(a100).toMatchObject({ vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "PCIe", modelId: "20b5" });
      const v100 = node.gpus.find(g => g.name === "v100")!;
      expect(v100).toMatchObject({ vendor: "nvidia", name: "v100", memorySize: "32Gi", interface: "PCIe", modelId: "1db4" });
    });

    it("derives storage capability flags from per-node persistentStorage classes (beta1/2/3 -> HDD/SSD/NVME)", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "p",
        inventory: {
          nodes: [
            {
              name: "n1",
              cpu: { available: 100 },
              memory: { available: 100 },
              ephStorage: { available: 100 },
              gpu: [],
              persistentStorage: [
                { class: "beta2", available: 100 },
                { class: "beta3", available: 200 }
              ]
            }
          ],
          storage: []
        }
      });

      const [candidate] = await repository.findCandidates(zeroAggregates(), {});

      expect(candidate.lastSuccessfulSnapshot.nodes[0]).toMatchObject({
        capabilitiesStorageHDD: false,
        capabilitiesStorageSSD: true,
        capabilitiesStorageNVME: true
      });
    });

    it("hydrates cluster storage pools with allocatable mapped from `available` and allocated=0", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "p",
        inventory: {
          nodes: [],
          storage: [
            { class: "beta2", available: 100000 },
            { class: "beta3", available: 200000 }
          ]
        }
      });

      const [candidate] = await repository.findCandidates(zeroAggregates(), {});

      expect(candidate.lastSuccessfulSnapshot.storage).toEqual([
        { class: "beta2", allocatable: 100000, allocated: 0 },
        { class: "beta3", allocatable: 200000, allocated: 0 }
      ]);
    });
  });

  describe("multi-filter and combination scenarios", () => {
    it("combines GPU vendor/model, persistent storage class, glob attribute, and signedBy filters in a single round trip", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "all-match",
        gpuModels: ["nvidia/a100"],
        storageClasses: ["beta3"],
        selfAttributes: [{ key: "region", value: "us-east-1" }],
        auditedBy: ["auditor-a", AUDITOR],
        totalAvailableGpu: 2n,
        totalAvailablePersistent: 1000n,
        maxNodeFreeGpu: 2n
      });
      await seedProvider({ owner: "no-gpu", storageClasses: ["beta3"], selfAttributes: [{ key: "region", value: "us-east-1" }], auditedBy: ["auditor-a"] });
      await seedProvider({
        owner: "wrong-region",
        gpuModels: ["nvidia/a100"],
        storageClasses: ["beta3"],
        selfAttributes: [{ key: "region", value: "eu-west-1" }],
        auditedBy: ["auditor-a"]
      });

      const owners = await ownerSetFrom(
        repository.findCandidates(
          makeAggregates({
            gpuVendor: "nvidia",
            gpuModel: "a100",
            persistentStorageClass: "beta3",
            totalGpu: 1n,
            maxPerReplicaGpu: 1n,
            totalPersistentStorage: 100n
          }),
          { attributes: [{ key: "region", value: "us-*" }], signedBy: { anyOf: ["auditor-a"] } }
        )
      );

      expect(owners).toEqual(new Set(["all-match"]));
    });

    it("handles mixed ephemeral and persistent storage requirements", async () => {
      const { repository } = setup();
      await seedProvider({
        owner: "ephemeral-only",
        totalAvailableEph: 100000n,
        totalAvailablePersistent: 0n,
        storageClasses: []
      });
      await seedProvider({
        owner: "mixed",
        totalAvailableEph: 100000n,
        totalAvailablePersistent: 100000n,
        storageClasses: ["beta2"]
      });

      const owners = await ownerSetFrom(
        repository.findCandidates(makeAggregates({ totalEphemeralStorage: 100n, totalPersistentStorage: 100n, persistentStorageClass: "beta2" }), {})
      );

      expect(owners).toEqual(new Set(["mixed"]));
    });

    it("multi-resource-unit aggregates pass through the prefilter when sum across units is below thresholds", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "fits", totalAvailableCpu: 5000n, totalAvailableMemory: 10_000n, maxNodeFreeCpu: 3000n, maxNodeFreeMemory: 6000n });
      await seedProvider({ owner: "too-small-per-replica", totalAvailableCpu: 5000n, maxNodeFreeCpu: 1500n });

      const owners = await ownerSetFrom(
        repository.findCandidates(makeAggregates({ totalCpu: 5000n, totalMemory: 10_000n, maxPerReplicaCpu: 3000n, maxPerReplicaMemory: 6000n }), {})
      );

      expect(owners).toEqual(new Set(["fits"]));
    });

    it("RAM-backed storage is excluded from totalPersistentStorage prefilter and is not screened at the SQL layer", async () => {
      const { repository } = setup();
      await seedProvider({ owner: "no-persistent", totalAvailablePersistent: 0n });

      const owners = await ownerSetFrom(repository.findCandidates(makeAggregates({ totalPersistentStorage: 0n }), {}));

      expect(owners).toEqual(new Set(["no-persistent"]));
    });
  });

  function setup() {
    const testContainer = container.createChildContainer();
    testContainer.register(APP_CONFIG, { useValue: { AUDITOR_ADDRESS: AUDITOR } as EnvConfig });
    testContainer.register(BidScreeningRepository, { useClass: BidScreeningRepository }, { lifecycle: Lifecycle.ContainerScoped });

    const repository = testContainer.resolve(BidScreeningRepository);
    const pg = testContainer.resolve(PG_CLIENT);
    return { repository, pg };
  }
});

interface SeedInput {
  owner: string;
  hostUri?: string;
  ipRegion?: string | null;
  uptime7d?: number | null;
  isOnline?: boolean;
  isOnlineSince?: Date | null;
  totalAvailableCpu?: bigint;
  totalAvailableMemory?: bigint;
  totalAvailableGpu?: bigint;
  totalAvailableEph?: bigint;
  totalAvailablePersistent?: bigint;
  maxNodeFreeCpu?: bigint;
  maxNodeFreeMemory?: bigint;
  maxNodeFreeGpu?: bigint;
  gpuModels?: string[];
  storageClasses?: string[];
  selfAttributes?: { key: string; value: string }[];
  signedAttributes?: { key: string; value: string; auditor: string }[];
  auditedBy?: string[];
  inventory?: Inventory;
}

async function seedProvider(input: SeedInput): Promise<void> {
  const pg = container.resolve(PG_CLIENT);
  await pg.unsafe(
    `
      INSERT INTO provider_inventory (
        owner, host_uri, created_height, ip_region, uptime_7d,
        is_online, is_online_since, inventory,
        total_available_cpu, total_available_memory, total_available_gpu,
        total_available_eph, total_available_persistent,
        max_node_free_cpu, max_node_free_memory, max_node_free_gpu,
        gpu_models, storage_classes, self_attributes, signed_attributes, audited_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb,
        $9::bigint, $10::bigint, $11::bigint,
        $12::bigint, $13::bigint,
        $14::bigint, $15::bigint, $16::bigint,
        $17::text[], $18::text[], $19::jsonb, $20::jsonb, $21::text[]
      )
    `,
    [
      input.owner,
      input.hostUri ?? `https://${input.owner}.example:8443`,
      "100",
      input.ipRegion ?? null,
      input.uptime7d ?? null,
      input.isOnline ?? true,
      input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
      JSON.stringify(input.inventory ?? { nodes: [], storage: [] }),
      (input.totalAvailableCpu ?? 0n).toString(),
      (input.totalAvailableMemory ?? 0n).toString(),
      (input.totalAvailableGpu ?? 0n).toString(),
      (input.totalAvailableEph ?? 0n).toString(),
      (input.totalAvailablePersistent ?? 0n).toString(),
      (input.maxNodeFreeCpu ?? 0n).toString(),
      (input.maxNodeFreeMemory ?? 0n).toString(),
      (input.maxNodeFreeGpu ?? 0n).toString(),
      input.gpuModels ?? [],
      input.storageClasses ?? [],
      JSON.stringify(input.selfAttributes ?? []),
      JSON.stringify(input.signedAttributes ?? []),
      input.auditedBy ?? []
    ] as postgres.ParameterOrJSON<never>[]
  );
}

function zeroAggregates(): ResourceAggregates {
  return makeAggregates();
}

function makeAggregates(overrides?: Partial<ResourceAggregates>): ResourceAggregates {
  return {
    totalCpu: 0n,
    totalMemory: 0n,
    totalGpu: 0n,
    maxPerReplicaCpu: 0n,
    maxPerReplicaMemory: 0n,
    maxPerReplicaGpu: 0n,
    totalEphemeralStorage: 0n,
    totalPersistentStorage: 0n,
    ...overrides
  };
}

async function ownerSetFrom(promise: ReturnType<BidScreeningRepository["findCandidates"]>): Promise<Set<string>> {
  const candidates = await promise;
  return new Set(candidates.map(c => c.owner));
}
