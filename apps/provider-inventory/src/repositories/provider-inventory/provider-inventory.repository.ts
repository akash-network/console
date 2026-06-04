import type { LoggerService } from "@akashnetwork/logging";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gt, inArray, sql as rawSql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { paginate } from "@src/lib/generators/paginate/paginate";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import { ClusterState } from "@src/types/inventory";
import { mapToStoredClusterState } from "./stored-cluster-state-mapper/stored-cluster-state-mapper";

export type ProviderInventory = InferSelectModel<typeof providerInventory>;

const DEFAULT_ONLINE_STREAM_BATCH_SIZE = 500;

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

  async *streamOnlineProviders(options?: { batchSize?: number }): AsyncGenerator<Pick<ProviderInventory, "owner" | "hostUri">> {
    const batchSize = options?.batchSize ?? DEFAULT_ONLINE_STREAM_BATCH_SIZE;
    const baseQuery = this.#db
      .select({ owner: providerInventory.owner, hostUri: providerInventory.hostUri })
      .from(providerInventory)
      .orderBy(providerInventory.owner)
      .limit(batchSize);

    const allProviders = paginate<Pick<ProviderInventory, "owner" | "hostUri">, string>(async key => {
      const where = key === undefined ? eq(providerInventory.isOnline, true) : and(eq(providerInventory.isOnline, true), gt(providerInventory.owner, key));
      const items = await baseQuery.where(where);
      const nextKey = items.length === batchSize ? items[items.length - 1].owner : undefined;
      return { items, nextKey };
    });

    for await (const batch of allProviders) {
      for (const row of batch) yield row;
    }
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

  async updateInventory(provider: ChainProvider, cluster: ClusterState): Promise<void> {
    const row = mapToStoredClusterState(cluster);
    await this.#db
      .update(providerInventory)
      .set({
        inventory: row.cluster,
        totalAvailableCpu: row.totalAvailableCpu,
        totalAvailableMemory: row.totalAvailableMemory,
        totalAvailableGpu: row.totalAvailableGpu,
        totalAvailableEph: row.totalAvailableEph,
        totalAvailableLeasedIp: row.totalAvailableLeasedIp,
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
    if (providers.length === 0) return;

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
