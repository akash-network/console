import "@src/providers";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { ResourcePair } from "@src/lib/resource-pair/resource-pair";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { RequestedResourceUnit } from "@src/types/inventory.types";
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

  describe("ClusterState hydration", () => {
    it("rebuilds ResourcePair instances from persisted inventory JSONB", async () => {
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

      const node = row.cluster.nodes[0];
      expect(node.cpu).toBeInstanceOf(ResourcePair);
      expect(node.cpu.allocatable).toBe(8000n);
      expect(node.cpu.allocated).toBe(2000n);
      expect(node.memory.allocatable).toBe(17179869184n);
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
    maxNodeFreeCpu?: bigint;
    maxNodeFreeMemory?: bigint;
    maxNodeFreeGpu?: bigint;
    selfAttributes?: { key: string; value: string }[];
    auditedBy?: string[];
    inventory?: unknown;
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
      maxNodeFreeCpu: input.maxNodeFreeCpu ?? 1_000_000n,
      maxNodeFreeMemory: input.maxNodeFreeMemory ?? 1_000_000_000n,
      maxNodeFreeGpu: input.maxNodeFreeGpu ?? 0n,
      selfAttributes: input.selfAttributes ?? [],
      auditedBy: input.auditedBy ?? [],
      inventory: input.inventory ?? { nodes: [], storage: {} }
    });
  }
});

function unit(input: { cpu?: bigint; memory?: bigint; gpu?: bigint; count?: number }): RequestedResourceUnit {
  return {
    id: 1,
    count: input.count ?? 1,
    resources: {
      cpu: { units: input.cpu ?? 0n, attributes: [] },
      memory: { quantity: input.memory ?? 0n, attributes: [] },
      gpu: { units: input.gpu ?? 0n, attributes: [] },
      storage: []
    }
  };
}

function requirements(input?: Partial<GroupSpecJSON["requirements"]>): GroupSpecJSON["requirements"] {
  return {
    signedBy: input?.signedBy ?? { allOf: [], anyOf: [] },
    attributes: input?.attributes ?? []
  };
}

function owners(rows: { owner: string }[]): string[] {
  return rows.map(r => r.owner).sort();
}
