import createError from "http-errors";
import { DatabaseError, QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain/providers/sequelize.provider";
import { ChainConfigService } from "@src/chain/services/chain-config/chain-config.service";

const QUERY_CANCELED_CODE = "57014";

@singleton()
export class BoundedChainQueryService {
  readonly #chainDb: Sequelize;
  readonly #config: ChainConfigService;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize, config: ChainConfigService) {
    this.#chainDb = chainDb;
    this.#config = config;
  }

  /** Sets the timeout inside its own transaction so the pooled connection goes back with the database's default. */
  async select<T extends object>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
    try {
      return await this.#chainDb.transaction(async transaction => {
        await this.#chainDb.query("SET LOCAL statement_timeout = :timeoutMs", {
          transaction,
          replacements: { timeoutMs: this.#config.get("BOUNDED_CHAIN_QUERY_TIMEOUT_MS") }
        });

        return await this.#chainDb.query<T>(sql, { type: QueryTypes.SELECT, replacements, transaction });
      });
    } catch (error) {
      if (isQueryCanceled(error)) throw createError(503, "Chain data query timed out");
      throw error;
    }
  }
}

function isQueryCanceled(error: unknown): boolean {
  return error instanceof DatabaseError && (error.original as { code?: string }).code === QUERY_CANCELED_CODE;
}
