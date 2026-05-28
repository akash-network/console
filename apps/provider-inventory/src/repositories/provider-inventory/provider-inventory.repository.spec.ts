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

  describe("bulkUpsertProviders", () => {
    it("upserts a row for each provider with its attributes", async () => {
      const { writer, db } = setup();

      await writer.bulkUpsertProviders([createProvider({ owner: "a", hostUri: "https://h:8443" })]);

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db._insertValues).toHaveBeenCalledWith([expect.objectContaining({ owner: "a", hostUri: "https://h:8443" })]);
    });

    it("sorts the provider's auditedBy list before writing", async () => {
      const provider = createProvider({ owner: "a", auditedBy: ["auditor-z", "auditor-a"] });
      const { writer, db } = setup();

      await writer.bulkUpsertProviders([provider]);

      expect(db._insertValues).toHaveBeenCalledWith([expect.objectContaining({ auditedBy: ["auditor-a", "auditor-z"] })]);
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
    selfAttributes: [],
    signedAttributes: [],
    auditedBy: [],
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
