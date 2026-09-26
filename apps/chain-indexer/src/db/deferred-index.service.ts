import { eq, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { IndexerDeferredIndexes } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

/**
 * Secondary indexes no writer consults. Primary keys and unique indexes stay because the natural-key
 * upserts depend on them, and `balance_changes_account_denom_height_idx` stays because the ledger
 * seeks through it for every batch's running-balance baseline.
 */
/** Overlapping pods of one writer role both restore at boot; CREATE INDEX IF NOT EXISTS is not atomic across sessions, so the two are serialized. Distinct from the other advisory-lock keys of this app. */
export const INDEX_DEFERRAL_LOCK_KEY = 7_431_003;

export const DEFERRABLE_INDEXES: ReadonlyArray<{ schema: string; name: string }> = [
  { schema: "cosmos", name: "transactions_hash_idx" },
  { schema: "cosmos", name: "messages_type_id_idx" },
  { schema: "cosmos", name: "message_dead_letters_type_id_idx" },
  { schema: "akash", name: "deployments_owner_created_idx" },
  { schema: "akash", name: "deployments_open_idx" },
  { schema: "akash", name: "leases_provider_idx" },
  { schema: "akash", name: "leases_open_idx" },
  { schema: "akash", name: "bme_ledger_records_height_idx" },
  { schema: "akash", name: "bme_ledger_records_burned_denom_height_idx" },
  { schema: "akash", name: "bme_ledger_records_minted_denom_height_idx" },
  { schema: "akash", name: "bme_canceled_records_height_idx" }
];

type PresentIndex = {
  schema: string;
  name: string;
  definition: string;
};

/**
 * Drops the deferrable secondary indexes for a heavy backfill and recreates them afterwards from the
 * definitions recorded in `indexer_deferred_indexes`, so a dropped index can never be forgotten: any
 * run that starts without the deferral flag restores whatever is recorded before doing anything else.
 */
@singleton()
export class DeferredIndexService {
  readonly #db: ChainDatabase;
  readonly #logger: LoggerService;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#logger = logger;
    this.#logger.setContext("DEFERRED_INDEXES");
  }

  async defer(): Promise<string[]> {
    const present = await this.#presentDeferrableIndexes();
    if (present.length === 0) {
      return [];
    }

    await this.#db.transaction(async tx => {
      await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${INDEX_DEFERRAL_LOCK_KEY})`));
      await tx
        .insert(IndexerDeferredIndexes)
        .values(present.map(index => ({ name: index.name, definition: index.definition, deferredAt: new Date() })))
        .onConflictDoNothing();
      for (const index of present) {
        await tx.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(index.schema)}.${sql.identifier(index.name)}`);
      }
    });

    const names = present.map(index => index.name);
    this.#logger.info({ event: "INDEXES_DEFERRED", indexes: names });
    return names;
  }

  async restore(): Promise<string[]> {
    return this.#db.transaction(async tx => {
      await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${INDEX_DEFERRAL_LOCK_KEY})`));
      const deferred = await tx.select().from(IndexerDeferredIndexes).orderBy(IndexerDeferredIndexes.name);

      for (const index of deferred) {
        const startedAt = Date.now();
        this.#logger.info({ event: "INDEX_RESTORING", index: index.name });
        await tx.execute(sql.raw(asIdempotentCreate(index.definition)));
        await tx.delete(IndexerDeferredIndexes).where(eq(IndexerDeferredIndexes.name, index.name));
        this.#logger.info({ event: "INDEX_RESTORED", index: index.name, durationMs: Date.now() - startedAt });
      }

      return deferred.map(index => index.name);
    });
  }

  async listDeferred(): Promise<string[]> {
    const rows = await this.#db.select({ name: IndexerDeferredIndexes.name }).from(IndexerDeferredIndexes).orderBy(IndexerDeferredIndexes.name);
    return rows.map(row => row.name);
  }

  async #presentDeferrableIndexes(): Promise<PresentIndex[]> {
    const candidates = sql.join(
      DEFERRABLE_INDEXES.map(index => sql`(${index.schema}, ${index.name})`),
      sql`, `
    );
    const rows = await this.#db.execute<PresentIndex>(
      sql`SELECT schemaname AS schema, indexname AS name, indexdef AS definition FROM pg_indexes WHERE (schemaname, indexname) IN (${candidates}) ORDER BY indexname`
    );
    return [...rows];
  }
}

/** pg_indexes renders `CREATE INDEX name ...`; IF NOT EXISTS makes a restore interrupted between the create and the record deletion safe to rerun. */
function asIdempotentCreate(definition: string): string {
  return definition.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ");
}
