import type { LoggerService } from "@akashnetwork/logging";
import { sql as rawSql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";

@singleton()
export class ProviderInventoryWriterService {
  #logger: LoggerService;
  #db: PostgresJsDatabase;

  constructor(@inject(DRIZZLE_DB) db: PostgresJsDatabase, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#db = db;
    this.#logger = loggerFactory({ context: "ProviderInventoryWriter" });
  }

  async resetOnlineSince(): Promise<void> {
    await this.#db.update(providerInventory).set({ isOnlineSince: null });
    this.#logger.info({ event: "ONLINE_SINCE_RESET" });
  }

  async upsertInventory(provider: ChainProvider, row: ProjectedRow): Promise<void> {
    const set = {
      hostUri: provider.hostUri,
      createdHeight: provider.createdHeight,
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
      isOnline: true as const,
      isOnlineSince: rawSql`coalesce(${providerInventory.isOnlineSince}, now())`,
      updatedAt: rawSql`now()`
    };

    await this.#db
      .insert(providerInventory)
      .values({ owner: provider.owner, ...set })
      .onConflictDoUpdate({ target: providerInventory.owner, set });

    this.#logger.debug({ event: "PROVIDER_INVENTORY_UPSERTED", owner: provider.owner });
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
}
