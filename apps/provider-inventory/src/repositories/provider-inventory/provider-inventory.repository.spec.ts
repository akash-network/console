import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { Inventory, ProjectedRow } from "@src/types/inventory";
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
  });

  describe("getOnlineProvidersWithSnapshots", () => {
    it("maps node available capacity into allocatable with allocated=0", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: "us-east",
            uptime7d: 0.998,
            inventory: createInventory({
              nodes: [
                {
                  name: "node1",
                  cpu: { available: 8000 },
                  memory: { available: 17179869184 },
                  gpu: [],
                  ephStorage: { available: 107374182400 },
                  persistentStorage: []
                }
              ]
            })
          }
        ]
      });

      const result = await writer.getOnlineProvidersWithSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ owner: "akash1abc", hostUri: "https://h:8443", ipRegion: "us-east", uptime7d: 0.998 });
      const node = result[0].lastSuccessfulSnapshot.nodes[0];
      expect(node).toMatchObject({
        name: "node1",
        cpuAllocatable: 8000,
        cpuAllocated: 0,
        memoryAllocatable: 17179869184,
        memoryAllocated: 0,
        ephemeralStorageAllocatable: 107374182400,
        ephemeralStorageAllocated: 0,
        gpuAllocatable: 0,
        gpuAllocated: 0,
        capabilitiesStorageHDD: false,
        capabilitiesStorageSSD: false,
        capabilitiesStorageNVME: false
      });
    });

    it("derives storage class capabilities from persistentStorage entries", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: null,
            uptime7d: null,
            inventory: createInventory({
              nodes: [
                {
                  name: "node1",
                  cpu: { available: 0 },
                  memory: { available: 0 },
                  gpu: [],
                  ephStorage: { available: 0 },
                  persistentStorage: [
                    { class: "beta2", available: 0 },
                    { class: "beta3", available: 0 }
                  ]
                }
              ]
            })
          }
        ]
      });

      const result = await writer.getOnlineProvidersWithSnapshots();

      const node = result[0].lastSuccessfulSnapshot.nodes[0];
      expect(node.capabilitiesStorageHDD).toBe(false);
      expect(node.capabilitiesStorageSSD).toBe(true);
      expect(node.capabilitiesStorageNVME).toBe(true);
    });

    it("aggregates per-gpu available into a single gpuAllocatable", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: null,
            uptime7d: null,
            inventory: createInventory({
              nodes: [
                {
                  name: "node1",
                  cpu: { available: 0 },
                  memory: { available: 0 },
                  gpu: [
                    { vendor: "nvidia", model: "a100", available: 2 },
                    { vendor: "nvidia", model: "h100", available: 1 }
                  ],
                  ephStorage: { available: 0 },
                  persistentStorage: []
                }
              ]
            })
          }
        ]
      });

      const result = await writer.getOnlineProvidersWithSnapshots();

      expect(result[0].lastSuccessfulSnapshot.nodes[0].gpuAllocatable).toBe(3);
      expect(result[0].lastSuccessfulSnapshot.nodes[0].gpus).toHaveLength(2);
    });

    it("maps cluster storage pools with allocated=0", async () => {
      const { writer } = setup({
        selectRows: [
          {
            owner: "akash1abc",
            hostUri: "https://h:8443",
            ipRegion: null,
            uptime7d: null,
            inventory: createInventory({ storage: [{ class: "beta2", available: 536870912000 }] })
          }
        ]
      });

      const result = await writer.getOnlineProvidersWithSnapshots();

      expect(result[0].lastSuccessfulSnapshot.storage).toEqual([{ class: "beta2", allocatable: 536870912000, allocated: 0 }]);
    });

    it("returns empty array when no rows match", async () => {
      const { writer } = setup({ selectRows: [] });
      expect(await writer.getOnlineProvidersWithSnapshots()).toEqual([]);
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
  return {
    inventory: { nodes: [], storage: [] },
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

function createInventory(overrides?: Partial<Inventory>): Inventory {
  return {
    nodes: overrides?.nodes ?? [],
    storage: overrides?.storage ?? []
  };
}
