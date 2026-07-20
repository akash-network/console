import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT, PostgresJsSession } from "drizzle-orm/postgres-js/session";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Sql } from "postgres";
import { container, singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg } from "@src/core/providers/postgres.provider";

type TxType = "PG_TX";

export type ApiTransaction = PgTransaction<PostgresJsQueryResultHKT, ApiPgTables, ExtractTablesWithRelations<ApiPgTables>>;

@singleton()
export class TxService {
  private readonly storage = new AsyncLocalStorage<Map<TxType, ApiTransaction>>();

  constructor(@InjectPg() private readonly pg: ApiPgDatabase) {}

  async transaction<T>(cb: () => Promise<T>) {
    const existingTx = this.storage.getStore()?.get("PG_TX");

    if (existingTx) {
      return await cb();
    }

    return await this.pg.transaction(async tx => {
      return this.storage.run(new Map(), async () => {
        this.storage.getStore()?.set("PG_TX", tx);
        return await cb();
      });
    });
  }

  getPgTx() {
    return this.storage.getStore()?.get("PG_TX");
  }

  getConnection(): Sql | undefined {
    const tx = this.getPgTx();
    if (!tx) return undefined;

    return (tx._.session as PostgresJsSession<Sql, ApiPgTables, ExtractTablesWithRelations<ApiPgTables>>).client;
  }
}

export function WithTransaction() {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return await container.resolve(TxService).transaction(async () => {
        return await originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
