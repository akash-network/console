import "@src/providers";

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import { parseGPUAttributes } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import { parseStorageAttributes } from "@src/mappers/storage-attribute-parser/storage-attribute-parser";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { RequestedResourceUnit, ResourceAttribute } from "@src/types/inventory";
import type { PlacementRequirements } from "./bid-screening.aggregator";
import { AUDITOR, BidScreeningRepository } from "./bid-screening.repository";

describe(BidScreeningRepository.name, () => {
  let repository: BidScreeningRepository;
  let db: PostgresJsDatabase;

  beforeEach(() => {
    repository = container.resolve(BidScreeningRepository);
    db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
  });

  describe("capacity filters", () => {
    it("excludes providers whose total available capacity falls short", async () => {
      await seed({ owner: "akash1small", totalAvailableCpu: 500n, maxNodeFreeCpu: 500n });
      await seed({ owner: "akash1big", totalAvailableCpu: 2000n, maxNodeFreeCpu: 2000n });

      const rows = await repository.findCandidates([unit({ cpu: 1000n, count: 1 })], requirements());

      expect(owners(rows)).toEqual(["akash1big"]);
    });

    it("excludes providers whose largest node cannot fit a single replica", async () => {
      await seed({ owner: "akash1fragmented", totalAvailableCpu: 4000n, maxNodeFreeCpu: 100n });
      await seed({ owner: "akash1roomy", totalAvailableCpu: 4000n, maxNodeFreeCpu: 400n });

      const rows = await repository.findCandidates([unit({ cpu: 200n, count: 1 })], requirements());

      expect(owners(rows)).toEqual(["akash1roomy"]);
    });

    it("excludes providers whose memory headroom covers the bare unit but not the combined memory + ram-class volume demand", async () => {
      // Workload requests 100 bytes of memory + a 200-byte ram-class volume → 300 bytes per replica.
      const replicaMemory = 100n;
      const ramVolume = 200n;
      const effectivePerReplica = replicaMemory + ramVolume;

      await seed({
        owner: "akash1tightOnMemory",
        totalAvailableMemory: effectivePerReplica - 1n,
        maxNodeFreeMemory: effectivePerReplica - 1n
      });
      await seed({
        owner: "akash1fits",
        totalAvailableMemory: effectivePerReplica,
        maxNodeFreeMemory: effectivePerReplica
      });

      const rows = await repository.findCandidates(
        [
          unit({
            memory: replicaMemory,
            count: 1,
            storage: [{ name: "shm", quantity: ramVolume, attributes: [{ key: "class", value: "ram" }] }]
          })
        ],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1fits"]);
    });
  });

  describe("signedBy", () => {
    it("requires every auditor in allOf via @>", async () => {
      await seed({ owner: "akash1a", auditedBy: ["aud-a"] });
      await seed({ owner: "akash1ab", auditedBy: ["aud-a", "aud-b"] });

      const rows = await repository.findCandidates([unit({})], requirements({ signedBy: { allOf: ["aud-a", "aud-b"], anyOf: [] } }));

      expect(owners(rows)).toEqual(["akash1ab"]);
    });

    it("matches any auditor in anyOf via &&", async () => {
      await seed({ owner: "akash1a", auditedBy: ["aud-a"] });
      await seed({ owner: "akash1c", auditedBy: ["aud-c"] });
      await seed({ owner: "akash1none", auditedBy: [] });

      const rows = await repository.findCandidates([unit({})], requirements({ signedBy: { allOf: [], anyOf: ["aud-a", "aud-b"] } }));

      expect(owners(rows)).toEqual(["akash1a"]);
    });

    it("omits the clause entirely when signedBy is empty", async () => {
      await seed({ owner: "akash1audited", auditedBy: ["aud-a"] });
      await seed({ owner: "akash1unaudited", auditedBy: [] });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows).sort()).toEqual(["akash1audited", "akash1unaudited"]);
    });
  });

  describe("self-attribute filters", () => {
    it("matches exact-key attributes via jsonb @>", async () => {
      await seed({ owner: "akash1east", selfAttributes: [{ key: "region", value: "us-east" }] });
      await seed({ owner: "akash1west", selfAttributes: [{ key: "region", value: "us-west" }] });

      const rows = await repository.findCandidates([unit({})], requirements({ attributes: [{ key: "region", value: "us-east" }] }));

      expect(owners(rows)).toEqual(["akash1east"]);
    });

    it("trailing-* glob does not cross path separators", async () => {
      await seed({ owner: "akash1leaf", selfAttributes: [{ key: "host/gpu", value: "true" }] });
      await seed({ owner: "akash1nested", selfAttributes: [{ key: "host/gpu/foo", value: "true" }] });

      const rows = await repository.findCandidates([unit({})], requirements({ attributes: [{ key: "host/*", value: "true" }] }));

      expect(owners(rows)).toEqual(["akash1leaf"]);
    });

    it("ANDs exact and glob clauses", async () => {
      await seed({
        owner: "akash1both",
        selfAttributes: [
          { key: "region", value: "us-east" },
          { key: "host/gpu", value: "true" }
        ]
      });
      await seed({
        owner: "akash1regionOnly",
        selfAttributes: [{ key: "region", value: "us-east" }]
      });
      await seed({
        owner: "akash1hostOnly",
        selfAttributes: [{ key: "host/gpu", value: "true" }]
      });

      const rows = await repository.findCandidates(
        [unit({})],
        requirements({
          attributes: [
            { key: "region", value: "us-east" },
            { key: "host/*", value: "true" }
          ]
        })
      );

      expect(owners(rows)).toEqual(["akash1both"]);
    });

    it("compares values case-sensitively", async () => {
      await seed({ owner: "akash1lower", selfAttributes: [{ key: "region", value: "us-east" }] });

      const rows = await repository.findCandidates([unit({})], requirements({ attributes: [{ key: "region", value: "US-EAST" }] }));

      expect(rows).toEqual([]);
    });
  });

  describe("isAudited projection", () => {
    it("returns isAudited=true when auditedBy contains the canonical AUDITOR", async () => {
      await seed({ owner: "akash1audited", auditedBy: [AUDITOR] });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(rows[0]).toMatchObject({ owner: "akash1audited", isAudited: true });
    });

    it("returns isAudited=false when signedBy matches a different auditor", async () => {
      await seed({ owner: "akash1other", auditedBy: ["aud-x"] });

      const rows = await repository.findCandidates([unit({})], requirements({ signedBy: { allOf: ["aud-x"], anyOf: [] } }));

      expect(rows[0]).toMatchObject({ owner: "akash1other", isAudited: false });
    });
  });

  describe("createdAt projection", () => {
    it("returns the persisted created_at as the candidate enrollment date", async () => {
      const enrolledAt = new Date("2025-07-15T12:34:56.789Z");
      await seed({ owner: "akash1enrolled", createdAt: enrolledAt });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.createdAt).toBe(enrolledAt.toISOString());
    });
  });

  describe("location projection", () => {
    it("prefers location-region from signed_attributes when both sets define it", async () => {
      await seed({
        owner: "akash1signed",
        selfAttributes: [{ key: "location-region", value: "self-region" }],
        signedAttributes: [{ key: "location-region", value: "signed-region", auditor: AUDITOR }]
      });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.location).toBe("signed-region");
    });

    it("falls back to self_attributes when signed_attributes has no location-region", async () => {
      await seed({
        owner: "akash1self",
        selfAttributes: [{ key: "location-region", value: "self-region" }],
        signedAttributes: [{ key: "country", value: "us", auditor: AUDITOR }]
      });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.location).toBe("self-region");
    });

    it("returns null when neither attribute set defines location-region", async () => {
      await seed({ owner: "akash1none", selfAttributes: [{ key: "country", value: "us" }] });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.location).toBeNull();
    });
  });

  describe("organization projection", () => {
    it("prefers organization from signed_attributes when both sets define it", async () => {
      await seed({
        owner: "akash1signedorg",
        selfAttributes: [{ key: "organization", value: "self-org" }],
        signedAttributes: [{ key: "organization", value: "signed-org", auditor: AUDITOR }]
      });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.organization).toBe("signed-org");
    });

    it("falls back to self_attributes when signed_attributes has no organization", async () => {
      await seed({
        owner: "akash1selforg",
        selfAttributes: [{ key: "organization", value: "self-org" }],
        signedAttributes: [{ key: "country", value: "us", auditor: AUDITOR }]
      });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.organization).toBe("self-org");
    });

    it("returns null when neither attribute set defines organization", async () => {
      await seed({ owner: "akash1noorg", selfAttributes: [{ key: "country", value: "us" }] });

      const [row] = await repository.findCandidates([unit({})], requirements());

      expect(row.organization).toBeNull();
    });
  });

  describe("gpu_models filter", () => {
    it("vendor-only request matches mixed-model providers via the vendor token", async () => {
      await seed({ owner: "akash1nvidiaA100", gpuModels: ["nvidia", "nvidia/a100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });
      await seed({ owner: "akash1nvidiaH100", gpuModels: ["nvidia", "nvidia/h100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });

      const rows = await repository.findCandidates([unit({ gpu: 1n, gpuAttributes: [{ key: "vendor/nvidia", value: "true" }] })], requirements());

      expect(owners(rows)).toEqual(["akash1nvidiaA100", "akash1nvidiaH100"]);
    });

    it("vendor-only request excludes wrong-vendor providers", async () => {
      await seed({ owner: "akash1nvidia", gpuModels: ["nvidia", "nvidia/a100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });
      await seed({ owner: "akash1amd", gpuModels: ["amd", "amd/mi300x"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });

      const rows = await repository.findCandidates([unit({ gpu: 1n, gpuAttributes: [{ key: "vendor/nvidia", value: "true" }] })], requirements());

      expect(owners(rows)).toEqual(["akash1nvidia"]);
    });

    it("treats multiple GPU attributes on one unit as OR alternatives via overlap", async () => {
      await seed({ owner: "akash1nvidia", gpuModels: ["nvidia", "nvidia/a100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });
      await seed({ owner: "akash1amd", gpuModels: ["amd", "amd/mi300x"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });
      await seed({ owner: "akash1intel", gpuModels: ["intel", "intel/gaudi3"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });

      const rows = await repository.findCandidates(
        [
          unit({
            gpu: 1n,
            gpuAttributes: [
              { key: "vendor/nvidia/model/a100", value: "true" },
              { key: "vendor/amd/model/mi300x", value: "true" }
            ]
          })
        ],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1amd", "akash1nvidia"]);
    });

    it("emits a separate clause per non-empty unit and ANDs them, so providers must cover divergent GPU needs", async () => {
      await seed({ owner: "akash1nvidiaOnly", gpuModels: ["nvidia", "nvidia/a100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });
      await seed({
        owner: "akash1mixed",
        gpuModels: ["nvidia", "nvidia/a100", "amd", "amd/mi300x"],
        totalAvailableGpu: 8n,
        maxNodeFreeGpu: 8n
      });

      const rows = await repository.findCandidates(
        [
          unit({ gpu: 1n, gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] }),
          unit({ gpu: 1n, gpuAttributes: [{ key: "vendor/amd/model/mi300x", value: "true" }] })
        ],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1mixed"]);
    });

    it("omits the clause for units without GPU requirements, so no-GPU providers stay in the result", async () => {
      await seed({ owner: "akash1noGpu", gpuModels: [] });
      await seed({ owner: "akash1withGpu", gpuModels: ["nvidia", "nvidia/a100"], totalAvailableGpu: 8n, maxNodeFreeGpu: 8n });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows)).toEqual(["akash1noGpu", "akash1withGpu"]);
    });
  });

  describe("storage_classes filter", () => {
    it("requires the provider to declare the unit's persistent class via @>", async () => {
      await seed({
        owner: "akash1beta2",
        storageClasses: ["beta2"],
        totalAvailablePersistent: 10_000n
      });
      await seed({
        owner: "akash1beta3",
        storageClasses: ["beta3"],
        totalAvailablePersistent: 10_000n
      });

      const rows = await repository.findCandidates([unit({ storage: [persistentVolume("data", 1_000n, "beta2")] })], requirements());

      expect(owners(rows)).toEqual(["akash1beta2"]);
    });

    it("requires the provider to declare every persistent class on the unit (containment, not overlap)", async () => {
      await seed({
        owner: "akash1beta2Only",
        storageClasses: ["beta2"],
        totalAvailablePersistent: 10_000n
      });
      await seed({
        owner: "akash1beta3Only",
        storageClasses: ["beta3"],
        totalAvailablePersistent: 10_000n
      });
      await seed({
        owner: "akash1both",
        storageClasses: ["beta2", "beta3"],
        totalAvailablePersistent: 10_000n
      });

      const rows = await repository.findCandidates(
        [
          unit({
            storage: [persistentVolume("data", 1_000n, "beta2"), persistentVolume("logs", 500n, "beta3")]
          })
        ],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1both"]);
    });

    it("omits the clause entirely for units without persistent storage, so providers with no storage classes stay in the result", async () => {
      await seed({ owner: "akash1noStorage", storageClasses: [] });
      await seed({ owner: "akash1withStorage", storageClasses: ["beta2"] });

      const rows = await repository.findCandidates([unit({ storage: [{ name: "scratch", quantity: 500n, attributes: [] }] })], requirements());

      expect(owners(rows)).toEqual(["akash1noStorage", "akash1withStorage"]);
    });

    it("emits a clause only for units with persistent volumes in a mixed deployment", async () => {
      await seed({
        owner: "akash1beta2",
        storageClasses: ["beta2"],
        totalAvailablePersistent: 10_000n
      });
      await seed({
        owner: "akash1noStorage",
        storageClasses: [],
        totalAvailablePersistent: 0n
      });

      const rows = await repository.findCandidates(
        [unit({ storage: [persistentVolume("data", 1_000n, "beta2")] }), unit({ storage: [{ name: "scratch", quantity: 500n, attributes: [] }] })],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1beta2"]);
    });
  });

  describe("leased IP filter", () => {
    it("excludes providers whose total available leased IPs falls short of the request", async () => {
      await seed({ owner: "akash1noIps", totalAvailableLeasedIp: 0n });
      await seed({ owner: "akash1oneIp", totalAvailableLeasedIp: 1n });

      const rows = await repository.findCandidates([unit({ endpoints: [leasedIp(1)] })], requirements());

      expect(owners(rows)).toEqual(["akash1oneIp"]);
    });

    it("includes a provider whose leased IP capacity exactly meets the request", async () => {
      await seed({ owner: "akash1exact", totalAvailableLeasedIp: 2n });
      await seed({ owner: "akash1short", totalAvailableLeasedIp: 1n });

      const rows = await repository.findCandidates([unit({ endpoints: [leasedIp(1), leasedIp(2)] })], requirements());

      expect(owners(rows)).toEqual(["akash1exact"]);
    });

    it("counts unique sequenceNumbers across units, so duplicates do not inflate the requirement", async () => {
      await seed({ owner: "akash1oneIp", totalAvailableLeasedIp: 1n });

      // Same sequenceNumber across two units is a single leased IP → one provider IP is enough.
      const rows = await repository.findCandidates([unit({ endpoints: [leasedIp(7)] }), unit({ endpoints: [leasedIp(7)] })], requirements());

      expect(owners(rows)).toEqual(["akash1oneIp"]);
    });

    it("sums distinct sequenceNumbers across units when computing the requirement", async () => {
      await seed({ owner: "akash1oneIp", totalAvailableLeasedIp: 1n });
      await seed({ owner: "akash1twoIps", totalAvailableLeasedIp: 2n });

      const rows = await repository.findCandidates([unit({ endpoints: [leasedIp(1)] }), unit({ endpoints: [leasedIp(2)] })], requirements());

      expect(owners(rows)).toEqual(["akash1twoIps"]);
    });

    it("ignores non-LEASED_IP endpoints when computing the requirement, so zero-IP providers stay in the result", async () => {
      await seed({ owner: "akash1noIps", totalAvailableLeasedIp: 0n });

      const rows = await repository.findCandidates(
        [
          unit({
            endpoints: [
              { kind: "SHARED_HTTP", sequenceNumber: 1 },
              { kind: "RANDOM_PORT", sequenceNumber: 2 }
            ]
          })
        ],
        requirements()
      );

      expect(owners(rows)).toEqual(["akash1noIps"]);
    });

    it("keeps providers with no leased IP capacity when the deployment requests none", async () => {
      await seed({ owner: "akash1noIps", totalAvailableLeasedIp: 0n });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows)).toEqual(["akash1noIps"]);
    });
  });

  describe("reclamation window filter", () => {
    // AEP-82: providers must offer a reclamation window meeting or exceeding the tenant's requested minimum.
    it("excludes providers whose reclamation window is shorter than the requested minimum", async () => {
      await seed({ owner: "akash1short", reclamationWindow: 1800 });
      await seed({ owner: "akash1long", reclamationWindow: 7200 });

      const rows = await repository.findCandidates([unit({})], requirements({ reclamationWindow: 3600 }));

      expect(owners(rows)).toEqual(["akash1long"]);
    });

    it("includes a provider whose reclamation window exactly meets the requested minimum", async () => {
      await seed({ owner: "akash1exact", reclamationWindow: 3600 });
      await seed({ owner: "akash1under", reclamationWindow: 3599 });

      const rows = await repository.findCandidates([unit({})], requirements({ reclamationWindow: 3600 }));

      expect(owners(rows)).toEqual(["akash1exact"]);
    });

    it("excludes providers that do not advertise a reclamation window when one is requested", async () => {
      await seed({ owner: "akash1none", reclamationWindow: null });
      await seed({ owner: "akash1offers", reclamationWindow: 7200 });

      const rows = await repository.findCandidates([unit({})], requirements({ reclamationWindow: 3600 }));

      expect(owners(rows)).toEqual(["akash1offers"]);
    });

    it("omits the clause entirely when no reclamation window is requested, so providers without one stay in the result", async () => {
      await seed({ owner: "akash1none", reclamationWindow: null });
      await seed({ owner: "akash1offers", reclamationWindow: 7200 });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows)).toEqual(["akash1none", "akash1offers"]);
    });
  });

  describe("online filter", () => {
    it("excludes rows where is_online is false", async () => {
      await seed({ owner: "akash1up" });
      await seed({ owner: "akash1down", isOnline: false });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows)).toEqual(["akash1up"]);
    });

    it("excludes rows where is_online_since is null", async () => {
      await seed({ owner: "akash1stable" });
      await seed({ owner: "akash1ghost", isOnlineSince: null });

      const rows = await repository.findCandidates([unit({})], requirements());

      expect(owners(rows)).toEqual(["akash1stable"]);
    });
  });

  describe("ClusterState passthrough", () => {
    it("returns the persisted inventory JSONB as the candidate cluster state", async () => {
      await seed({
        owner: "akash1full",
        inventory: {
          nodes: [
            {
              name: "node1",
              cpu: { allocatable: 8000, allocated: 2000 },
              memory: { allocatable: 17179869184, allocated: 0 },
              ephemeralStorage: { allocatable: 0, allocated: 0 },
              gpu: { quantity: { allocatable: 0, allocated: 0 }, info: [] },
              storageClasses: ["beta2"],
              cpus: []
            }
          ],
          storage: {}
        }
      });

      const [row] = await repository.findCandidates([unit({})], requirements());

      const node = row.cluster?.nodes?.[0];
      expect(node?.cpu).toEqual({ allocatable: 8000, allocated: 2000 });
      expect(node?.memory).toEqual({ allocatable: 17179869184, allocated: 0 });
    });
  });

  describe("inventory cache", () => {
    it("returns the same cached candidate instance when the row is unchanged", async () => {
      await seed({ owner: "akash1cacheHit" });

      const [first] = await repository.findCandidates([unit({})], requirements());
      const [second] = await repository.findCandidates([unit({})], requirements());

      // Same object reference proves the second call was served from cache, not re-fetched.
      expect(second).toBe(first);
    });

    it("re-fetches a fresh candidate instance after updatedAt changes", async () => {
      await seed({ owner: "akash1cacheBump" });
      const [first] = await repository.findCandidates([unit({})], requirements());

      await db
        .update(providerInventory)
        .set({ updatedAt: new Date("2999-01-01T00:00:00Z") })
        .where(eq(providerInventory.owner, "akash1cacheBump"));

      const [second] = await repository.findCandidates([unit({})], requirements());

      expect(second).not.toBe(first);
      expect(second.updatedAt).not.toBe(first.updatedAt);
    });

    it("reuses cached providers while fetching only the uncached ones in a mixed batch", async () => {
      await seed({ owner: "akash1cacheWarm" });
      const [warm] = await repository.findCandidates([unit({})], requirements());

      await seed({ owner: "akash1cacheCold" });
      const batch = await repository.findCandidates([unit({})], requirements());

      const warmAgain = batch.find(candidate => candidate.owner === "akash1cacheWarm");
      const cold = batch.find(candidate => candidate.owner === "akash1cacheCold");

      expect(warmAgain).toBe(warm);
      expect(cold).not.toBe(warm);
      expect(cold?.owner).toBe("akash1cacheCold");
    });
  });

  interface SeedInput {
    owner: string;
    hostUri?: string;
    isOnline?: boolean;
    isOnlineSince?: Date | null;
    totalAvailableCpu?: bigint;
    totalAvailableMemory?: bigint;
    totalAvailableGpu?: bigint;
    totalAvailableEph?: bigint;
    totalAvailablePersistent?: bigint;
    totalAvailableLeasedIp?: bigint;
    maxNodeFreeCpu?: bigint;
    maxNodeFreeMemory?: bigint;
    maxNodeFreeGpu?: bigint;
    selfAttributes?: { key: string; value: string }[];
    signedAttributes?: { key: string; value: string; auditor: string }[];
    auditedBy?: string[];
    gpuModels?: string[];
    storageClasses?: string[];
    reclamationWindow?: number | null;
    inventory?: unknown;
    createdAt?: Date;
  }

  async function seed(input: SeedInput): Promise<void> {
    await db.insert(providerInventory).values({
      owner: input.owner,
      hostUri: input.hostUri ?? `https://${input.owner}:8443`,
      isOnline: input.isOnline ?? true,
      isOnlineSince: input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
      totalAvailableCpu: input.totalAvailableCpu ?? 1_000_000n,
      totalAvailableMemory: input.totalAvailableMemory ?? 1_000_000_000n,
      totalAvailableGpu: input.totalAvailableGpu ?? 0n,
      totalAvailableEph: input.totalAvailableEph ?? 1_000_000_000n,
      totalAvailablePersistent: input.totalAvailablePersistent ?? 0n,
      totalAvailableLeasedIp: input.totalAvailableLeasedIp ?? 0n,
      maxNodeFreeCpu: input.maxNodeFreeCpu ?? 1_000_000n,
      maxNodeFreeMemory: input.maxNodeFreeMemory ?? 1_000_000_000n,
      maxNodeFreeGpu: input.maxNodeFreeGpu ?? 0n,
      selfAttributes: input.selfAttributes ?? [],
      signedAttributes: input.signedAttributes ?? [],
      auditedBy: input.auditedBy ?? [],
      gpuModels: input.gpuModels ?? [],
      storageClasses: input.storageClasses ?? [],
      reclamationWindow: input.reclamationWindow ?? null,
      inventory: input.inventory ?? { nodes: [], storage: {} },
      createdAt: input.createdAt
    });
  }
});

function unit(input: {
  cpu?: bigint;
  memory?: bigint;
  gpu?: bigint;
  count?: number;
  gpuAttributes?: ResourceAttribute[];
  storage?: RawStorageVolume[];
  endpoints?: Array<{ kind: string; sequenceNumber: number }>;
}): RequestedResourceUnit {
  return {
    id: 1,
    count: input.count ?? 1,
    resources: {
      cpu: { units: input.cpu ?? 0n, fingerprint: null },
      memory: { quantity: input.memory ?? 0n },
      gpu: { units: input.gpu ?? 0n, attributes: parseGPUAttributes(input.gpuAttributes ?? []) },
      storage: (input.storage ?? []).map(s => ({ name: s.name, quantity: s.quantity, attributes: parseStorageAttributes(s.attributes) })),
      endpoints: input.endpoints ?? []
    }
  };
}

function leasedIp(sequenceNumber: number): { kind: string; sequenceNumber: number } {
  return { kind: "LEASED_IP", sequenceNumber };
}

function persistentVolume(name: string, quantity: bigint, storageClass: string): RawStorageVolume {
  return {
    name,
    quantity,
    attributes: [
      { key: "persistent", value: "true" },
      { key: "class", value: storageClass }
    ]
  };
}

function requirements(input?: Partial<PlacementRequirements>): PlacementRequirements {
  return {
    signedBy: input?.signedBy ?? { allOf: [], anyOf: [] },
    attributes: input?.attributes ?? [],
    reclamationWindow: input?.reclamationWindow
  };
}

function owners(rows: { owner: string }[]): string[] {
  return rows.map(r => r.owner).sort();
}

interface RawStorageVolume {
  name: string;
  quantity: bigint;
  attributes: ResourceAttribute[];
}
