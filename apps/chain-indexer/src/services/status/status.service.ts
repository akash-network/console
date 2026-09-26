import { count, eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { DeferredIndexService } from "@src/db/deferred-index.service";
import { IndexerState, JobRuns, MessageDeadLetters, MessageTypes } from "@src/db/schema";
import type { StatusResponse } from "@src/http-schemas/status.schema";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

@singleton()
export class StatusService {
  readonly #db: ChainDatabase;
  readonly #deferredIndexes: DeferredIndexService;
  readonly #config: EnvConfig;

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(DeferredIndexService) deferredIndexes: DeferredIndexService, @inject(APP_CONFIG) config: EnvConfig) {
    this.#db = db;
    this.#deferredIndexes = deferredIndexes;
    this.#config = config;
  }

  async getStatus(): Promise<StatusResponse> {
    const [checkpoints, deadLetters, deferredIndexes, jobRuns] = await Promise.all([
      this.#db.select().from(IndexerState),
      this.#countDeadLettersByType(),
      this.#deferredIndexes.listDeferred(),
      this.#db.select().from(JobRuns).orderBy(JobRuns.name)
    ]);

    return {
      data: {
        network: this.#config.NETWORK,
        role: this.#config.INDEXER_ROLE,
        checkpoints: checkpoints.map(checkpoint => ({
          stream: checkpoint.stream,
          lastHeight: checkpoint.lastHeight,
          updatedAt: checkpoint.updatedAt.toISOString()
        })),
        deadLetters: {
          total: deadLetters.reduce((total, row) => total + row.count, 0),
          byType: deadLetters
        },
        deferredIndexes,
        jobs: jobRuns.map(run => ({
          name: run.name,
          lastStartedAt: run.lastStartedAt.toISOString(),
          lastFinishedAt: run.lastFinishedAt?.toISOString() ?? null,
          lastStatus: run.lastStatus,
          lastError: run.lastError,
          successCount: run.successCount,
          failureCount: run.failureCount
        }))
      }
    };
  }

  async #countDeadLettersByType(): Promise<Array<{ type: string; count: number }>> {
    return await this.#db
      .select({ type: MessageTypes.type, count: count() })
      .from(MessageDeadLetters)
      .innerJoin(MessageTypes, eq(MessageDeadLetters.typeId, MessageTypes.id))
      .groupBy(MessageTypes.type);
  }
}
