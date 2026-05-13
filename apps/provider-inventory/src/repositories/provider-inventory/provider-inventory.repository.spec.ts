import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ResourcePair } from "@src/lib/resource-pair/resource-pair";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";
import { ProviderInventoryRepository } from "./provider-inventory.repository";

describe(ProviderInventoryRepository.name, () => {
  describe("deleteByOwner", () => {
    it("deletes the row for the given owner", async () => {
      const { writer, db } = setup();

      await writer.deleteByOwner("akash1gone");

      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(db._deleteWhere).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertAttributes", () => {
    it("upserts the row with the provider's attributes", async () => {
      const { writer, db } = setup();

      await writer.upsertAttributes(createProvider({ owner: "a", hostUri: "https://h:8443", createdHeight: 100n }));

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db._insertValues).toHaveBeenCalledWith(expect.objectContaining({ owner: "a", hostUri: "https://h:8443", createdHeight: 100n }));
    });

    it("computes auditedBy as a sorted, deduped list of auditors", async () => {
      const provider = createProvider({
        owner: "a",
        signedAttributes: [
          { key: "k1", value: "v1", auditor: "auditor-z" },
          { key: "k2", value: "v2", auditor: "auditor-a" },
          { key: "k3", value: "v3", auditor: "auditor-a" }
        ]
      });
      const { writer, db } = setup();

      await writer.upsertAttributes(provider);

      expect(db._insertValues).toHaveBeenCalledWith(expect.objectContaining({ auditedBy: ["auditor-a", "auditor-z"] }));
    });
  });

  describe("updateInventory", () => {
    it("only UPDATEs the existing row — a loser without an attributes row never gets one written", async () => {
      const { writer, db } = setup();
      const row: ProjectedRow = createProjectedRow({ cpu: 1000n });

      await writer.updateInventory(createProvider({ owner: "a", hostUri: "https://h:8443" }), row);

      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db._updateSet).toHaveBeenCalledWith(expect.objectContaining({ totalAvailableCpu: 1000n, isOnline: true }));
    });

    it("writes the ClusterState as inventory JSONB", async () => {
      const { writer, db } = setup();
      const cluster = createProjectedRow({ cpu: 8000n }).cluster;

      await writer.updateInventory(createProvider({ owner: "a" }), { ...createProjectedRow(), cluster });

      expect(db._updateSet).toHaveBeenCalledWith(expect.objectContaining({ inventory: cluster }));
    });
  });

  describe("getOnlineProviders", () => {
    it("hydrates persisted ClusterState back into ResourcePair instances", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: "us-east",
            uptime7d: 0.998,
            inventory: {
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
            }
          }
        ]
      });

      const result = await writer.getOnlineProviders();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ owner: "akash1abc", hostUri: "https://h:8443", ipRegion: "us-east", uptime7d: 0.998 });
      const node = result[0].cluster.nodes[0];
      expect(node.name).toBe("node1");
      expect(node.cpu.allocatable).toBe(8000n);
      expect(node.cpu.allocated).toBe(2000n);
      expect(node.memory.allocatable).toBe(17179869184n);
      expect(node.memory.allocated).toBe(4294967296n);
      expect(node.ephemeralStorage.allocatable).toBe(107374182400n);
      expect(node.ephemeralStorage.allocated).toBe(0n);
      expect(node.storageClasses).toEqual(["beta2"]);
    });

    it("hydrates cluster storage pools as ResourcePair entries keyed by class", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: null,
            uptime7d: null,
            inventory: {
              nodes: [],
              storage: { beta2: { class: "beta2", quantity: { allocatable: 536870912000, allocated: 0 } } }
            }
          }
        ]
      });

      const result = await writer.getOnlineProviders();

      const beta2 = result[0].cluster.storage["beta2"];
      expect(beta2.class).toBe("beta2");
      expect(beta2.quantity.allocatable).toBe(536870912000n);
      expect(beta2.quantity.allocated).toBe(0n);
    });

    it("preserves bigint magnitudes that exceed Number.MAX_SAFE_INTEGER", async () => {
      const unsafe = 9007199254740993n;
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: null,
            uptime7d: null,
            inventory: {
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
            }
          }
        ]
      });

      const result = await writer.getOnlineProviders();

      expect(result[0].cluster.nodes[0].cpu.allocatable).toBe(unsafe);
    });

    it("returns empty array when no rows match", async () => {
      const { writer } = setup({ selectRows: [] });
      expect(await writer.getOnlineProviders()).toEqual([]);
    });
  });

  describe("getAuditedProviderAddresses", () => {
    it("returns empty set when no auditors are given without hitting the DB", async () => {
      const { writer, db } = setup();

      const result = await writer.getAuditedProviderAddresses([]);

      expect(result).toEqual(new Set());
      expect(db.select).not.toHaveBeenCalled();
    });

    it("returns the set of owners whose auditedBy overlaps the requested auditors", async () => {
      const { writer } = setup({ selectRows: [{ owner: "akash1abc" }, { owner: "akash1def" }] });

      const result = await writer.getAuditedProviderAddresses(["auditor-a"]);

      expect(result).toEqual(new Set(["akash1abc", "akash1def"]));
    });
  });

  function setup(input?: { selectRows?: unknown[] }) {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const insertOnConflict = vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertOnConflict });
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const selectWhere = vi.fn().mockResolvedValue(input?.selectRows ?? []);
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

    const db = {
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      select: vi.fn().mockReturnValue({ from: selectFrom }),
      _deleteWhere: deleteWhere,
      _insertValues: insertValues,
      _onConflictDoUpdate: insertOnConflict,
      _updateSet: updateSet,
      _updateWhere: updateWhere,
      _selectFrom: selectFrom,
      _selectWhere: selectWhere
    };

    const logger = mock<ReturnType<LoggerFactory>>();
    const loggerFactory: LoggerFactory = () => logger;

    const writer = new ProviderInventoryRepository(db as unknown as PostgresJsDatabase, loggerFactory);
    return { writer, db, logger };
  }
});

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1owner",
    hostUri: "https://p:8443",
    createdHeight: 100n,
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}

function createProjectedRow(overrides?: { cpu?: bigint }): ProjectedRow {
  const node = {
    name: "node-1",
    cpu: new ResourcePair(overrides?.cpu ?? 0n, 0n),
    memory: new ResourcePair(0n, 0n),
    ephemeralStorage: new ResourcePair(0n, 0n),
    gpu: { quantity: new ResourcePair(0n, 0n), info: [] },
    storageClasses: [],
    cpus: []
  };
  return {
    cluster: { nodes: [node], storage: Object.create(null) },
    totalAvailableCpu: overrides?.cpu ?? 0n,
    totalAvailableMemory: 0n,
    totalAvailableGpu: 0n,
    totalAvailableEph: 0n,
    totalAvailablePersistent: 0n,
    maxNodeFreeCpu: 0n,
    maxNodeFreeMemory: 0n,
    maxNodeFreeGpu: 0n,
    gpuModels: [],
    storageClasses: []
  };
}
