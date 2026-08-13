import { inArray } from "drizzle-orm";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { Accounts } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

/**
 * Resolves mid-chain addresses to account ids, creating any that don't exist yet. Unlike the genesis
 * account-seeder (which owns an empty table and reads ids straight back from `returning()`), addresses
 * appear unboundedly during sync, so this holds no permanent cache and resolves per batch: select existing,
 * insert the rest with `onConflictDoNothing().returning()`, then re-select any lost to a concurrent writer.
 * It runs on the base connection, not the commit transaction, so the interned rows are visible when the
 * transaction inserts ledger rows that reference them.
 */
@singleton()
export class AccountInterner {
  readonly #db: ChainDatabase;

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async resolve(addresses: Iterable<string>): Promise<Map<string, number>> {
    const unique = [...new Set(addresses)];
    const idByAddress = new Map<string, number>();

    if (unique.length === 0) {
      return idByAddress;
    }

    await this.#selectInto(idByAddress, unique);

    const missing = unique.filter(address => !idByAddress.has(address));
    if (missing.length === 0) {
      return idByAddress;
    }

    for (const addressChunk of chunk(missing, INSERT_CHUNK_SIZE)) {
      const inserted = await this.#db
        .insert(Accounts)
        .values(addressChunk.map(address => ({ address })))
        .onConflictDoNothing()
        .returning({ id: Accounts.id, address: Accounts.address });
      inserted.forEach(row => idByAddress.set(row.address, row.id));
    }

    const stillMissing = missing.filter(address => !idByAddress.has(address));
    if (stillMissing.length > 0) {
      await this.#selectInto(idByAddress, stillMissing);
    }

    return idByAddress;
  }

  async #selectInto(idByAddress: Map<string, number>, addresses: string[]): Promise<void> {
    for (const addressChunk of chunk(addresses, INSERT_CHUNK_SIZE)) {
      const rows = await this.#db.select({ id: Accounts.id, address: Accounts.address }).from(Accounts).where(inArray(Accounts.address, addressChunk));
      rows.forEach(row => idByAddress.set(row.address, row.id));
    }
  }
}
