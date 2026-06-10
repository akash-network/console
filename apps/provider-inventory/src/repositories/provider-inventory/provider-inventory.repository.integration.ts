import "@src/providers";

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ClusterState } from "@src/types/inventory";
import { ProviderInventoryRepository } from "./provider-inventory.repository";

describe(ProviderInventoryRepository.name, () => {
  describe("deleteByOwner", () => {
    it("deletes the row for the given owner", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1gone" });
      await seed(db, { owner: "akash1stays" });

      await repository.deleteByOwner("akash1gone");

      const remaining = await db.select({ owner: providerInventory.owner }).from(providerInventory);
      expect(remaining.map(r => r.owner).toSorted()).toEqual(["akash1stays"]);
    });

    it("deletes every row whose owner is in the given list", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a" });
      await seed(db, { owner: "akash1b" });
      await seed(db, { owner: "akash1c" });

      await repository.deleteByOwner(["akash1a", "akash1c"]);

      const remaining = await db.select({ owner: providerInventory.owner }).from(providerInventory);
      expect(remaining.map(r => r.owner)).toEqual(["akash1b"]);
    });
  });

  describe("bulkUpsertProviders", () => {
    it("inserts a row for each provider with its attributes", async () => {
      const { repository, db } = setup();

      await repository.bulkUpsertProviders([
        createProvider({
          owner: "akash1a",
          hostUri: "https://h:8443",
          selfAttributes: [{ key: "region", value: "us-east" }],
          signedAttributes: [{ key: "tier", value: "gold", auditor: "aud-1" }],
          auditedBy: ["aud-1"]
        })
      ]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row).toMatchObject({
        owner: "akash1a",
        hostUri: "https://h:8443",
        selfAttributes: [{ key: "region", value: "us-east" }],
        signedAttributes: [{ key: "tier", value: "gold", auditor: "aud-1" }],
        auditedBy: ["aud-1"]
      });
    });

    it("updates hostUri and attributes for an owner that already exists", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", hostUri: "https://old:8443", selfAttributes: [{ key: "region", value: "us-west" }] });

      await repository.bulkUpsertProviders([
        createProvider({
          owner: "akash1a",
          hostUri: "https://new:8443",
          selfAttributes: [{ key: "region", value: "us-east" }],
          auditedBy: ["aud-1"]
        })
      ]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row).toMatchObject({
        hostUri: "https://new:8443",
        selfAttributes: [{ key: "region", value: "us-east" }],
        auditedBy: ["aud-1"]
      });
    });

    it("leaves updatedAt untouched when the upserted values are identical", async () => {
      const { repository, db } = setup();
      const upsertedAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, {
        owner: "akash1a",
        hostUri: "https://h:8443",
        selfAttributes: [{ key: "region", value: "us-east" }],
        signedAttributes: [{ key: "tier", value: "gold", auditor: "aud-1" }],
        auditedBy: ["aud-1"],
        updatedAt: upsertedAt
      });

      await repository.bulkUpsertProviders([
        createProvider({
          owner: "akash1a",
          hostUri: "https://h:8443",
          selfAttributes: [{ key: "region", value: "us-east" }],
          signedAttributes: [{ key: "tier", value: "gold", auditor: "aud-1" }],
          auditedBy: ["aud-1"]
        })
      ]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.updatedAt.toISOString()).toBe(upsertedAt.toISOString());
    });

    it("bumps updatedAt when an attribute changes", async () => {
      const { repository, db } = setup();
      const upsertedAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, { owner: "akash1a", hostUri: "https://h:8443", selfAttributes: [{ key: "region", value: "us-east" }], updatedAt: upsertedAt });

      await repository.bulkUpsertProviders([
        createProvider({ owner: "akash1a", hostUri: "https://h:8443", selfAttributes: [{ key: "region", value: "us-west" }] })
      ]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.updatedAt.getTime()).toBeGreaterThan(upsertedAt.getTime());
    });

    it("sorts the provider's auditedBy list before writing", async () => {
      const { repository, db } = setup();

      await repository.bulkUpsertProviders([createProvider({ owner: "akash1a", auditedBy: ["auditor-z", "auditor-a"] })]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.auditedBy).toEqual(["auditor-a", "auditor-z"]);
    });

    it("is a no-op when called with an empty list", async () => {
      const { repository, db } = setup();

      await repository.bulkUpsertProviders([]);

      const rows = await db.select().from(providerInventory);
      expect(rows).toEqual([]);
    });
  });

  describe("streamOnlineProviders", () => {
    it("yields every row currently marked online in primary-key order", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1b", hostUri: "https://b:8443" });
      await seed(db, { owner: "akash1a", hostUri: "https://a:8443" });

      const result = await collect(repository.streamOnlineProviders({ batchSize: 10 }));

      expect(result).toEqual([
        { owner: "akash1a", hostUri: "https://a:8443" },
        { owner: "akash1b", hostUri: "https://b:8443" }
      ]);
    });

    it("skips rows that are marked offline", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1up", hostUri: "https://up:8443" });
      await seed(db, { owner: "akash1down", hostUri: "https://down:8443", isOnline: false });

      const result = await collect(repository.streamOnlineProviders({ batchSize: 10 }));

      expect(result).toEqual([{ owner: "akash1up", hostUri: "https://up:8443" }]);
    });

    it("keyset-paginates by owner across multiple pages until a short page ends the stream", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", hostUri: "https://a:8443" });
      await seed(db, { owner: "akash1b", hostUri: "https://b:8443" });
      await seed(db, { owner: "akash1c", hostUri: "https://c:8443" });

      const result = await collect(repository.streamOnlineProviders({ batchSize: 2 }));

      expect(result).toEqual([
        { owner: "akash1a", hostUri: "https://a:8443" },
        { owner: "akash1b", hostUri: "https://b:8443" },
        { owner: "akash1c", hostUri: "https://c:8443" }
      ]);
    });

    it("yields nothing when no rows are marked online (first-ever boot)", async () => {
      const { repository } = setup();

      const result = await collect(repository.streamOnlineProviders());

      expect(result).toEqual([]);
    });
  });

  describe("updateInventory", () => {
    it("updates the existing row and never inserts a row for an owner with no attributes row", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });

      await repository.updateInventory(createProvider({ owner: "akash1a" }), createCluster({ cpu: 1000n }));
      await repository.updateInventory(createProvider({ owner: "akash1loser" }), createCluster({ cpu: 1000n }));

      const rows = await db.select().from(providerInventory);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ owner: "akash1a", totalAvailableCpu: 1000n });
    });

    it("leaves online state untouched", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });

      await repository.updateInventory(createProvider({ owner: "akash1a" }), createCluster({ cpu: 1000n }));

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnline).toBe(false);
      expect(row.isOnlineSince).toBeNull();
    });

    it("writes the ClusterState as inventory JSONB", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });

      await repository.updateInventory(createProvider({ owner: "akash1a" }), createCluster({ cpu: 8000n }));

      const [stored] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(stored.inventory).toMatchObject({
        nodes: [
          {
            name: "node-1",
            cpu: { allocatable: 8000, allocated: 0 },
            memory: { allocatable: 0, allocated: 0 }
          }
        ]
      });
    });

    it("preserves an existing isOnlineSince across updates", async () => {
      const { repository, db } = setup();
      const firstSeenAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, { owner: "akash1a", isOnlineSince: firstSeenAt });

      await repository.updateInventory(createProvider({ owner: "akash1a" }), createCluster({ cpu: 1000n }));

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnlineSince?.toISOString()).toBe(firstSeenAt.toISOString());
    });
  });

  describe("markAsOnline", () => {
    it("flips an offline provider to online and stamps isOnlineSince", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });

      await repository.markAsOnline("akash1a");

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnline).toBe(true);
      expect(row.isOnlineSince).toBeInstanceOf(Date);
    });

    it("does not affect other providers", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });
      await seed(db, { owner: "akash1b", isOnline: false, isOnlineSince: null });

      await repository.markAsOnline("akash1a");

      const [other] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1b"));
      expect(other.isOnline).toBe(false);
      expect(other.isOnlineSince).toBeNull();
    });

    it("leaves an already-online provider's updatedAt and isOnlineSince untouched", async () => {
      const { repository, db } = setup();
      const onlineSince = new Date("2026-01-01T00:00:00Z");
      const updatedAt = new Date("2026-01-02T00:00:00Z");
      await seed(db, { owner: "akash1a", isOnline: true, isOnlineSince: onlineSince, updatedAt });

      await repository.markAsOnline("akash1a");

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnlineSince?.toISOString()).toBe(onlineSince.toISOString());
      expect(row.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    });
  });

  describe("bulkMarkOffline", () => {
    it("flips an online provider to offline and clears isOnlineSince", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: true, isOnlineSince: new Date() });

      await repository.bulkMarkOffline(["akash1a"]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnline).toBe(false);
      expect(row.isOnlineSince).toBeNull();
    });

    it("bumps updatedAt when transitioning from online to offline", async () => {
      const { repository, db } = setup();
      const updatedAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, { owner: "akash1a", isOnline: true, isOnlineSince: new Date(), updatedAt });

      await repository.bulkMarkOffline(["akash1a"]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.updatedAt.getTime()).toBeGreaterThan(updatedAt.getTime());
    });

    it("leaves an already-offline provider's updatedAt frozen so it can age into the dead-provider threshold", async () => {
      const { repository, db } = setup();
      const updatedAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null, updatedAt });

      await repository.bulkMarkOffline(["akash1a"]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    });

    it("only marks the listed owners offline", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: true, isOnlineSince: new Date() });
      await seed(db, { owner: "akash1b", isOnline: true, isOnlineSince: new Date() });

      await repository.bulkMarkOffline(["akash1a"]);

      const [other] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1b"));
      expect(other.isOnline).toBe(true);
    });

    it("is a no-op when called with an empty list", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: true, isOnlineSince: new Date() });

      await repository.bulkMarkOffline([]);

      const [row] = await db.select().from(providerInventory).where(eq(providerInventory.owner, "akash1a"));
      expect(row.isOnline).toBe(true);
    });
  });

  describe("getInventoryLastUpdatedPerOfflineProvider", () => {
    it("returns the updatedAt timestamp for each offline provider in the list", async () => {
      const { repository, db } = setup();
      const updatedAt = new Date("2026-01-01T00:00:00Z");
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null, updatedAt });

      const result = await repository.getInventoryLastUpdatedPerOfflineProvider(["akash1a"]);

      expect(result.get("akash1a")?.toISOString()).toBe(updatedAt.toISOString());
    });

    it("excludes providers that are currently online", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1online", isOnline: true, isOnlineSince: new Date() });
      await seed(db, { owner: "akash1offline", isOnline: false, isOnlineSince: null });

      const result = await repository.getInventoryLastUpdatedPerOfflineProvider(["akash1online", "akash1offline"]);

      expect(result.has("akash1online")).toBe(false);
      expect(result.has("akash1offline")).toBe(true);
    });

    it("excludes owners that are not in the requested list", async () => {
      const { repository, db } = setup();
      await seed(db, { owner: "akash1a", isOnline: false, isOnlineSince: null });
      await seed(db, { owner: "akash1b", isOnline: false, isOnlineSince: null });

      const result = await repository.getInventoryLastUpdatedPerOfflineProvider(["akash1a"]);

      expect([...result.keys()]).toEqual(["akash1a"]);
    });

    it("returns an empty map for an empty list", async () => {
      const { repository } = setup();

      const result = await repository.getInventoryLastUpdatedPerOfflineProvider([]);

      expect(result.size).toBe(0);
    });
  });

  function setup() {
    const repository = container.resolve(ProviderInventoryRepository);
    const db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
    return { repository, db };
  }
});

async function collect<T>(stream: AsyncGenerator<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

interface SeedInput {
  owner: string;
  hostUri?: string;
  isOnline?: boolean;
  isOnlineSince?: Date | null;
  selfAttributes?: { key: string; value: string }[];
  signedAttributes?: { key: string; value: string; auditor: string }[];
  auditedBy?: string[];
  updatedAt?: Date;
}

async function seed(db: PostgresJsDatabase, input: SeedInput): Promise<void> {
  await db.insert(providerInventory).values({
    owner: input.owner,
    hostUri: input.hostUri ?? `https://${input.owner}:8443`,
    isOnline: input.isOnline ?? true,
    isOnlineSince: input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
    selfAttributes: input.selfAttributes ?? [],
    signedAttributes: input.signedAttributes ?? [],
    auditedBy: input.auditedBy ?? [],
    ...(input.updatedAt && { updatedAt: input.updatedAt })
  });
}

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1owner",
    hostUri: "https://p:8443",
    selfAttributes: [],
    signedAttributes: [],
    auditedBy: [],
    ...overrides
  };
}

function createCluster(overrides?: { cpu?: bigint }): ClusterState {
  const node = {
    name: "node-1",
    cpu: { allocatable: overrides?.cpu ?? 0n, allocated: 0n },
    memory: { allocatable: 0n, allocated: 0n },
    ephemeralStorage: { allocatable: 0n, allocated: 0n },
    gpu: { quantity: { allocatable: 0n, allocated: 0n }, info: [] },
    storageClasses: [],
    cpus: []
  };
  return { nodes: [node], storage: Object.create(null) };
}
