import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gt, inArray, sql as rawSql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { paginate } from "@src/lib/generators/paginate/paginate";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import type { ChainProvider } from "@src/types/chain-provider";
import { ClusterState } from "@src/types/inventory";
import { DbDriver } from "../db-driver/db-driver";
import { mapToStoredClusterState } from "./stored-cluster-state-mapper/stored-cluster-state-mapper";

export type ProviderInventory = InferSelectModel<typeof providerInventory>;

const DEFAULT_ONLINE_STREAM_BATCH_SIZE = 500;

@singleton()
export class ProviderInventoryRepository {
  readonly #driver: DbDriver;

  constructor(dbDriver: DbDriver) {
    this.#driver = dbDriver;
  }

  async resetOnlineSince(): Promise<void> {
    await this.#driver.getDb().update(providerInventory).set({ isOnlineSince: null });
  }

  async *streamOnlineProviders(options?: { batchSize?: number }): AsyncGenerator<Pick<ProviderInventory, "owner" | "hostUri">> {
    const batchSize = options?.batchSize ?? DEFAULT_ONLINE_STREAM_BATCH_SIZE;
    const baseQuery = this.#driver
      .getDb()
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
    const db = this.#driver.getDb();
    if (Array.isArray(owner)) {
      await db.delete(providerInventory).where(inArray(providerInventory.owner, owner));
    } else {
      await db.delete(providerInventory).where(eq(providerInventory.owner, owner));
    }
  }

  async bulkMarkOffline(owners: string[]): Promise<void> {
    if (owners.length === 0) return;
    await this.#driver
      .getDb()
      .update(providerInventory)
      .set({ isOnline: false, isOnlineSince: null, updatedAt: rawSql`now()` })
      .where(and(inArray(providerInventory.owner, owners), eq(providerInventory.isOnline, true)));
  }

  async markAsOnline(owner: string): Promise<void> {
    await this.#driver
      .getDb()
      .update(providerInventory)
      .set({ isOnline: true, isOnlineSince: new Date(), updatedAt: rawSql`now()` })
      .where(and(eq(providerInventory.owner, owner), eq(providerInventory.isOnline, false)));
  }

  async updateInventory(provider: ChainProvider, cluster: ClusterState): Promise<void> {
    const row = mapToStoredClusterState(cluster);
    await this.#driver
      .getDb()
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
        updatedAt: rawSql`now()`
      })
      .where(eq(providerInventory.owner, provider.owner));
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

    const conflictColumns = [providerInventory.hostUri, providerInventory.selfAttributes, providerInventory.signedAttributes, providerInventory.auditedBy];
    const hasChanges = rawSql.join(
      conflictColumns.map(column => rawSql`${column} IS DISTINCT FROM excluded.${rawSql.raw(column.name)}`),
      rawSql` OR `
    );

    await this.#driver
      .getDb()
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
        },
        setWhere: hasChanges
      });
  }

  async getInventoryLastUpdatedPerOfflineProvider(providers: string[]): Promise<Map<string, Date | null>> {
    if (providers.length === 0) return new Map();
    const db = this.#driver.getDb();
    const rows = await db
      .select({
        owner: providerInventory.owner,
        updatedAt: providerInventory.updatedAt
      })
      .from(providerInventory)
      .where(and(inArray(providerInventory.owner, providers), eq(providerInventory.isOnline, false)));
    const result = new Map<string, Date | null>();
    for (const row of rows) {
      result.set(row.owner, new Date(row.updatedAt));
    }
    return result;
  }
}
