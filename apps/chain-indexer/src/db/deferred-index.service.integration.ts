import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { DeferredIndexService } from "@src/db/deferred-index.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

describe(DeferredIndexService.name, () => {
  it("drops the deferrable secondary indexes and records them", async () => {
    const { service, db } = await setup();
    const before = await indexNames(db);

    const deferred = await service.defer();

    expect(deferred).toEqual(expect.arrayContaining(["transactions_hash_idx", "messages_type_id_idx", "leases_provider_idx"]));
    expect(await indexNames(db)).toEqual(before.filter(name => !deferred.includes(name)));
    expect(await service.listDeferred()).toEqual(deferred);
  });

  it("keeps primary keys, unique indexes and the ledger baseline index in place", async () => {
    const { service, db } = await setup();

    await service.defer();

    expect(await indexNames(db)).toEqual(
      expect.arrayContaining([
        "transactions_height_index_pk",
        "accounts_address_idx",
        "balance_changes_height_event_index_idx",
        "balance_changes_account_denom_height_idx"
      ])
    );
  });

  it("restores every deferred index with its original definition and clears the record", async () => {
    const { service, db } = await setup();
    const definitionsBefore = await indexDefinitions(db);
    const deferred = await service.defer();

    const restored = await service.restore();

    expect(restored).toEqual(deferred);
    expect(await indexDefinitions(db)).toEqual(definitionsBefore);
    expect(await service.listDeferred()).toEqual([]);
  });

  it("restores once when two processes restore at the same time", async () => {
    const { service, db } = await setup();
    const before = await indexNames(db);
    await service.defer();

    await Promise.all([service.restore(), service.restore()]);

    expect(await indexNames(db)).toEqual(before);
    expect(await service.listDeferred()).toEqual([]);
  });

  it("is a no-op when nothing is deferred or when called twice", async () => {
    const { service } = await setup();

    expect(await service.restore()).toEqual([]);
    const deferred = await service.defer();
    expect(await service.defer()).toEqual([]);
    expect(await service.listDeferred()).toEqual(deferred);
    expect(await service.restore()).toEqual(deferred);
    expect(await service.restore()).toEqual([]);
  });

  async function setup() {
    const db = container.resolve(CHAIN_DB);
    const service = container.resolve(DeferredIndexService);
    await service.restore();
    return { service, db };
  }

  async function indexNames(db: ChainDatabase): Promise<string[]> {
    return (await indexDefinitions(db)).map(row => row.name);
  }

  async function indexDefinitions(db: ChainDatabase): Promise<Array<{ name: string; definition: string }>> {
    const rows = await db.execute<{ name: string; definition: string }>(
      sql`SELECT indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname IN ('cosmos', 'akash', 'public') ORDER BY indexname`
    );
    return [...rows];
  }
});
