import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT, PostgresJsSession } from "drizzle-orm/postgres-js/session";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Sql } from "postgres";
import { container, singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg } from "@src/core/providers/postgres.provider";

export type ApiTransaction = PgTransaction<PostgresJsQueryResultHKT, ApiPgTables, ExtractTablesWithRelations<ApiPgTables>>;

type TxContext = { tx: ApiTransaction; onCommit: Array<() => void> };

@singleton()
export class TxService {
  private readonly storage = new AsyncLocalStorage<TxContext>();

  constructor(@InjectPg() private readonly pg: ApiPgDatabase) {}

  async transaction<T>(cb: () => Promise<T>) {
    if (this.storage.getStore()) {
      return await cb();
    }

    const onCommit: TxContext["onCommit"] = [];
    const result = await this.pg.transaction(async tx => await this.storage.run({ tx, onCommit }, cb));
    onCommit.forEach(run => run());

    return result;
  }

  /** Runs once the outermost transaction commits, never after a rollback, and right away outside a transaction; `run` must not throw, since its transaction has already committed. */
  afterCommit(run: () => void): void {
    const context = this.storage.getStore();

    if (context) context.onCommit.push(run);
    else run();
  }

  getPgTx() {
    return this.storage.getStore()?.tx;
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
