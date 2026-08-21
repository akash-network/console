import type { PgTable } from "drizzle-orm/pg-core";
import chunk from "lodash/chunk";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import type { ChainTransaction } from "@src/providers/db.provider";

/**
 * Inserts `rows` in chunks that stay under postgres.js's bind-parameter limit. Conflicts are ignored by
 * default so a re-seed is idempotent; pass `onConflictDoNothing: false` where an outer guard already
 * enforces single-writing and every row must land (e.g. the genesis balance-change ledger).
 */
export async function insertChunked<TTable extends PgTable>(
  tx: ChainTransaction,
  table: TTable,
  rows: TTable["$inferInsert"][],
  { onConflictDoNothing = true }: { onConflictDoNothing?: boolean } = {}
): Promise<void> {
  for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
    const insert = tx.insert(table).values(rowChunk);
    await (onConflictDoNothing ? insert.onConflictDoNothing() : insert);
  }
}
