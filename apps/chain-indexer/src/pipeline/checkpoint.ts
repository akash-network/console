import { sql } from "drizzle-orm";

import { IndexerState } from "@src/db/schema";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";

/** The checkpoint only ever moves forward, so overlapping writers on one stream cannot regress it. */
export async function advanceCheckpoint(executor: ChainDatabase | ChainTransaction, stream: string, lastHeight: number): Promise<void> {
  await executor
    .insert(IndexerState)
    .values({ stream, lastHeight, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: IndexerState.stream,
      set: { lastHeight: sql`GREATEST(${IndexerState.lastHeight}, EXCLUDED.last_height)`, updatedAt: new Date() }
    });
}
