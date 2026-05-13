import type { LoggerService } from "@akashnetwork/logging";
import { and, arrayOverlaps, eq, sql as rawSql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { Inventory, ProjectedRow } from "@src/types/inventory";
import type { ProviderWithSnapshot } from "@src/types/provider";

const STORAGE_CLASS_HDD = "beta1";
const STORAGE_CLASS_SSD = "beta2";
const STORAGE_CLASS_NVME = "beta3";

@singleton()
export class ProviderInventoryRepository {
  readonly #logger: LoggerService;
  readonly #db: PostgresJsDatabase;

  constructor(@inject(DRIZZLE_DB) db: PostgresJsDatabase, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#db = db;
    this.#logger = loggerFactory({ context: "ProviderInventoryRepository" });
  }

  async resetOnlineSince(): Promise<void> {
    await this.#db.update(providerInventory).set({ isOnlineSince: null });
    this.#logger.info({ event: "ONLINE_SINCE_RESET" });
  }

  async deleteByOwner(owner: string): Promise<void> {
    await this.#db.delete(providerInventory).where(eq(providerInventory.owner, owner));
    this.#logger.info({ event: "PROVIDER_INVENTORY_DELETED", owner });
  }

  async markOffline(owner: string): Promise<void> {
    await this.#db
      .update(providerInventory)
      .set({ isOnline: false, isOnlineSince: null, updatedAt: rawSql`now()` })
      .where(eq(providerInventory.owner, owner));
    this.#logger.info({ event: "PROVIDER_MARKED_OFFLINE", owner });
  }

  async updateInventory(provider: ChainProvider, row: ProjectedRow): Promise<void> {
    await this.#db
      .update(providerInventory)
      .set({
        inventory: row.inventory,
        totalAvailableCpu: row.totalAvailableCpu,
        totalAvailableMemory: row.totalAvailableMemory,
        totalAvailableGpu: row.totalAvailableGpu,
        totalAvailableEph: row.totalAvailableEph,
        totalAvailablePersistent: row.totalAvailablePersistent,
        maxNodeFreeCpu: row.maxNodeFreeCpu,
        maxNodeFreeMemory: row.maxNodeFreeMemory,
        maxNodeFreeGpu: row.maxNodeFreeGpu,
        gpuModels: row.gpuModels,
        storageClasses: row.storageClasses,
        isOnline: true,
        isOnlineSince: rawSql`coalesce(${providerInventory.isOnlineSince}, now())`,
        updatedAt: rawSql`now()`
      })
      .where(eq(providerInventory.owner, provider.owner));

    this.#logger.debug({ event: "PROVIDER_INVENTORY_UPDATED", owner: provider.owner });
  }

  async upsertAttributes(provider: ChainProvider): Promise<void> {
    const auditedBy = [...new Set(provider.signedAttributes.map(a => a.auditor))].sort();
    const set = {
      hostUri: provider.hostUri,
      createdHeight: provider.createdHeight,
      selfAttributes: provider.selfAttributes,
      signedAttributes: provider.signedAttributes,
      auditedBy,
      updatedAt: rawSql`now()`
    };

    await this.#db
      .insert(providerInventory)
      .values({ owner: provider.owner, ...set })
      .onConflictDoUpdate({ target: providerInventory.owner, set });

    this.#logger.debug({ event: "PROVIDER_ATTRIBUTES_UPSERTED", owner: provider.owner });
  }

  async getOnlineProvidersWithSnapshots(): Promise<ProviderWithSnapshot[]> {
    const rows = await this.#db
      .select({
        owner: providerInventory.owner,
        hostUri: providerInventory.hostUri,
        ipRegion: providerInventory.ipRegion,
        uptime7d: providerInventory.uptime7d,
        inventory: providerInventory.inventory
      })
      .from(providerInventory)
      .where(and(eq(providerInventory.isOnline, true)));

    return rows.map(row => ({
      owner: row.owner,
      hostUri: row.hostUri,
      ipRegion: row.ipRegion,
      uptime7d: row.uptime7d,
      lastSuccessfulSnapshot: inventoryToSnapshot(row.inventory as Inventory)
    }));
  }

  async getAuditedProviderAddresses(auditorAddresses: string[]): Promise<Set<string>> {
    if (auditorAddresses.length === 0) {
      return new Set();
    }

    const rows = await this.#db
      .select({ owner: providerInventory.owner })
      .from(providerInventory)
      .where(arrayOverlaps(providerInventory.auditedBy, auditorAddresses));

    return new Set(rows.map(r => r.owner));
  }
}

function inventoryToSnapshot(inventory: Inventory): ProviderWithSnapshot["lastSuccessfulSnapshot"] {
  return {
    nodes: inventory.nodes.map(node => {
      const classes = new Set(node.persistentStorage.map(p => p.class));
      const gpuTotal = node.gpu.reduce((acc, g) => acc + g.available, 0);
      return {
        name: node.name,
        cpuAllocatable: node.cpu.available,
        cpuAllocated: 0,
        memoryAllocatable: node.memory.available,
        memoryAllocated: 0,
        ephemeralStorageAllocatable: node.ephStorage.available,
        ephemeralStorageAllocated: 0,
        gpuAllocatable: gpuTotal,
        gpuAllocated: 0,
        capabilitiesStorageHDD: classes.has(STORAGE_CLASS_HDD),
        capabilitiesStorageSSD: classes.has(STORAGE_CLASS_SSD),
        capabilitiesStorageNVME: classes.has(STORAGE_CLASS_NVME),
        gpus: node.gpu.map(g => ({
          vendor: g.vendor,
          name: g.model,
          modelId: "",
          interface: "",
          memorySize: ""
        })),
        cpus: []
      };
    }),
    storage: inventory.storage.map(s => ({
      class: s.class,
      allocatable: s.available,
      allocated: 0
    }))
  };
}
