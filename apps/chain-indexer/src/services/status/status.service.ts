import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { IndexerState } from "@src/db/schema";
import type { StatusResponse } from "@src/http-schemas/status.schema";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

@singleton()
export class StatusService {
  readonly #db: ChainDatabase;
  readonly #config: EnvConfig;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(APP_CONFIG) config: EnvConfig) {
    this.#db = db;
    this.#config = config;
  }

  async getStatus(): Promise<StatusResponse> {
    const checkpoints = await this.#db.select().from(IndexerState);

    return {
      data: {
        network: this.#config.NETWORK,
        role: this.#config.INDEXER_ROLE,
        checkpoints: checkpoints.map(checkpoint => ({
          stream: checkpoint.stream,
          lastHeight: checkpoint.lastHeight,
          updatedAt: checkpoint.updatedAt.toISOString()
        }))
      }
    };
  }
}
