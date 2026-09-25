import { like, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { inject, singleton } from "tsyringe";

import { IndexerState } from "@src/db/schema";
import { MODULE_OWNERSHIP } from "@src/pipeline/module-replay/module-tables";
import type { ReplayableModule } from "@src/pipeline/modules";
import type { ChainTransaction } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

/** Empties a module's tables (identity sequences included, so a from-scratch replay assigns the same ids a fresh backfill would) and its progress markers inside the caller's transaction. */
@singleton()
export class ModuleResetService {
  readonly #logger: LoggerService;

  constructor(@inject(LoggerService) logger: LoggerService) {
    this.#logger = logger;
    this.#logger.setContext("MODULE_RESET");
  }

  async reset(tx: ChainTransaction, module: ReplayableModule): Promise<void> {
    const ownership = MODULE_OWNERSHIP[module];
    const tableNames = ownership.tables.map(table => {
      const { schema, name } = getTableConfig(table);
      return `"${schema}"."${name}"`;
    });

    await tx.execute(sql.raw(`TRUNCATE ${tableNames.join(", ")} RESTART IDENTITY`));
    for (const pattern of ownership.statePatterns) {
      await tx.delete(IndexerState).where(like(IndexerState.stream, pattern));
    }

    this.#logger.info({ event: "MODULE_RESET", module, tables: tableNames.length });
  }
}
