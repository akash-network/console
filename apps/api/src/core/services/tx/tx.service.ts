import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { AsyncLocalStorage } from "node:async_hooks";
import { container, singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgSchema, InjectPg } from "@src/core/providers/postgres.provider";

type TxType = "PG_TX";

@singleton()
export class TxService {
  private readonly storage = new AsyncLocalStorage<Map<TxType, PgTransaction<NodePgQueryResultHKT, ApiPgSchema, ExtractTablesWithRelations<ApiPgSchema>>>>();

  constructor(@InjectPg() private readonly pg: ApiPgDatabase) {}

  async transaction(cb: () => Promise<void>) {
    await this.pg.transaction(async tx => {
      await new Promise((resolve, reject) => {
        this.storage.run(new Map(), () => {
          this.storage.getStore().set("PG_TX", tx);
          cb().then(resolve).catch(reject);
        });
      });
    });
  }

  getPgTx() {
    return this.storage.getStore()?.get("PG_TX");
  }
}

export function WithTransaction() {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const txManager = container.resolve(TxService);
      return txManager.transaction(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
