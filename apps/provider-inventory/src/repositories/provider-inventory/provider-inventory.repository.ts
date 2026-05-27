import type { LoggerService } from "@akashnetwork/logging";
import { eq, inArray, sql as rawSql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";

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

  async deleteByOwner(owner: string | string[]): Promise<void> {
    if (Array.isArray(owner)) {
      await this.#db.delete(providerInventory).where(inArray(providerInventory.owner, owner));
    } else {
      await this.#db.delete(providerInventory).where(eq(providerInventory.owner, owner));
    }
  }

  async bulkMarkOffline(owners: string[]): Promise<void> {
    if (owners.length === 0) return;
    await this.#db
      .update(providerInventory)
      .set({ isOnline: false, isOnlineSince: null, updatedAt: rawSql`now()` })
      .where(inArray(providerInventory.owner, owners));
    this.#logger.info({ event: "PROVIDERS_MARKED_OFFLINE", owners });
  }

  async updateInventory(provider: ChainProvider, row: ProjectedRow): Promise<void> {
    await this.#db
      .update(providerInventory)
      .set({
        inventory: row.cluster,
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

  async bulkUpsertProviders(providers: ChainProvider[]): Promise<void> {
    const NOW_SQL = rawSql`now()`;
    const rows = providers.map(provider => {
      return {
        owner: provider.owner,
        hostUri: provider.hostUri,
        selfAttributes: provider.selfAttributes,
        signedAttributes: provider.signedAttributes,
        auditedBy: provider.auditedBy.toSorted(),
        updatedAt: NOW_SQL
      };
    });

    await this.#db
      .insert(providerInventory)
      .values(rows)
      .onConflictDoUpdate({
        target: providerInventory.owner,
        set: {
          hostUri: rawSql.raw(`excluded.${providerInventory.hostUri.name}`),
          selfAttributes: rawSql.raw(`excluded.${providerInventory.selfAttributes.name}`),
          signedAttributes: rawSql.raw(`excluded.${providerInventory.signedAttributes.name}`),
          auditedBy: rawSql.raw(`excluded.${providerInventory.auditedBy.name}`),
          updatedAt: NOW_SQL
        }
      });
  }
}
