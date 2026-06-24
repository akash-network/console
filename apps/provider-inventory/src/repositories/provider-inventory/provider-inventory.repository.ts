import type { InferSelectModel } from "drizzle-orm";
import { and, eq, getTableName, gt, inArray, isNull, lt, or, sql as rawSql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { paginate } from "@src/lib/generators/paginate/paginate";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import { ClusterState } from "@src/types/inventory";
import { DbDriver } from "../db-driver/db-driver";
import { mapToStoredClusterState } from "./stored-cluster-state-mapper/stored-cluster-state-mapper";

export type ProviderInventory = InferSelectModel<typeof providerInventory>;

const DEFAULT_ONLINE_STREAM_BATCH_SIZE = 500;
const TABLE = getTableName(providerInventory);

@singleton()
export class ProviderInventoryRepository {
  readonly #driver: DbDriver;
  readonly #sql: Database;

  constructor(dbDriver: DbDriver, @inject(PG_CLIENT) sql: Database) {
    this.#driver = dbDriver;
    this.#sql = sql;
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

  async bulkMarkOffline(owners: string[], notUpdatedSince: Date): Promise<Pick<ProviderInventory, "owner">[]> {
    if (owners.length === 0) return [];
    return await this.#driver
      .getDb()
      .update(providerInventory)
      .set({ isOnline: false, isOnlineSince: null, updatedAt: rawSql`now()` })
      .where(and(inArray(providerInventory.owner, owners), eq(providerInventory.isOnline, true), lt(providerInventory.updatedAt, notUpdatedSince)))
      .returning({ owner: providerInventory.owner });
  }

  async markAsOnline(owner: string): Promise<void> {
    await this.#driver
      .getDb()
      .update(providerInventory)
      .set({ isOnline: true, isOnlineSince: new Date(), updatedAt: rawSql`now()` })
      .where(
        and(
          // keep new line
          eq(providerInventory.owner, owner),
          or(
            // keep new line
            eq(providerInventory.isOnline, false),
            isNull(providerInventory.isOnlineSince)
          )
        )
      );
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
        reclamationWindow: cluster.reclamationWindow ?? null,
        updatedAt: rawSql`now()`
      })
      .where(eq(providerInventory.owner, provider.owner));
  }

  async bulkUpsertProviders(providers: ChainProvider[]): Promise<Pick<ProviderInventory, "owner">[]> {
    if (providers.length === 0) return [];

    const sql = this.#sql;
    const c = providerInventory;
    const payload = providers.map(provider => ({
      [c.owner.name]: provider.owner,
      [c.hostUri.name]: provider.hostUri,
      [c.selfAttributes.name]: provider.selfAttributes,
      [c.signedAttributes.name]: provider.signedAttributes,
      [c.auditedBy.name]: provider.auditedBy.toSorted()
    }));

    // 2-3x faster than using drizzle-orm's insert().onConflict().doUpdate() for bulk upsert
    const rows = await sql<Array<Pick<ProviderInventory, "owner">>>`
      INSERT INTO ${sql(TABLE)} (
        ${sql(c.owner.name)}, ${sql(c.hostUri.name)}, ${sql(c.selfAttributes.name)}, ${sql(c.signedAttributes.name)}, ${sql(c.auditedBy.name)}, ${sql(c.updatedAt.name)}
      )
      SELECT ${sql(c.owner.name)}, ${sql(c.hostUri.name)}, ${sql(c.selfAttributes.name)}, ${sql(c.signedAttributes.name)}, ${sql(c.auditedBy.name)}, now()
      FROM jsonb_to_recordset(${sql.json(payload as Parameters<typeof sql.json>[0])}::jsonb) AS x(
        ${sql(c.owner.name)} text,
        ${sql(c.hostUri.name)} text,
        ${sql(c.selfAttributes.name)} jsonb,
        ${sql(c.signedAttributes.name)} jsonb,
        ${sql(c.auditedBy.name)} text[]
      )
      ON CONFLICT (${sql(c.owner.name)}) DO UPDATE SET
        ${sql(c.hostUri.name)} = excluded.${sql(c.hostUri.name)},
        ${sql(c.selfAttributes.name)} = excluded.${sql(c.selfAttributes.name)},
        ${sql(c.signedAttributes.name)} = excluded.${sql(c.signedAttributes.name)},
        ${sql(c.auditedBy.name)} = excluded.${sql(c.auditedBy.name)},
        ${sql(c.updatedAt.name)} = now()
      WHERE ${sql(TABLE)}.${sql(c.hostUri.name)} IS DISTINCT FROM excluded.${sql(c.hostUri.name)}
        OR ${sql(TABLE)}.${sql(c.selfAttributes.name)} IS DISTINCT FROM excluded.${sql(c.selfAttributes.name)}
        OR ${sql(TABLE)}.${sql(c.signedAttributes.name)} IS DISTINCT FROM excluded.${sql(c.signedAttributes.name)}
        OR ${sql(TABLE)}.${sql(c.auditedBy.name)} IS DISTINCT FROM excluded.${sql(c.auditedBy.name)}
      RETURNING ${sql(c.owner.name)}
    `;

    return rows.map(row => ({ owner: row.owner }));
  }
}
