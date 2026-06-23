import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js/session";
import { AsyncLocalStorage } from "node:async_hooks";
import { inject, singleton } from "tsyringe";

import { DRIZZLE_DB, type DrizzleDb } from "@src/providers/drizzle.provider";

@singleton()
export class DbDriver {
  readonly #storage = new AsyncLocalStorage<
    Map<"PG_TX", PgTransaction<PostgresJsQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>>
  >();
  readonly #db: DrizzleDb;

  constructor(@inject(DRIZZLE_DB) db: DrizzleDb) {
    this.#db = db;
  }

  async transaction<T>(cb: () => Promise<T>) {
    const existingTx = this.#storage.getStore()?.get("PG_TX");

    if (existingTx) {
      return await cb();
    }

    return await this.#db.transaction(async tx => {
      return this.#storage.run(new Map(), async () => {
        this.#storage.getStore()?.set("PG_TX", tx);
        return await cb();
      });
    });
  }

  getDb() {
    return this.#storage.getStore()?.get("PG_TX") ?? this.#db;
  }
}
