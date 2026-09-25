import { eq, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { ArchiveBlockSource } from "@src/archive/archive-block-source";
import { BlockArchiveService } from "@src/archive/block-archive.service";
import type { EnvConfig } from "@src/config/env.config";
import { Blocks, IndexerState } from "@src/db/schema";
import { GenesisImportService } from "@src/genesis/genesis-import.service";
import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";
import { BlockCommitterService, SYNC_STREAM } from "@src/pipeline/block-committer.service";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import { ChainContinuityError } from "@src/pipeline/chain-continuity-error";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { ModuleResetService } from "@src/pipeline/module-replay/module-reset.service";
import type { ReplayableModule } from "@src/pipeline/modules";
import { REPLAY_HANDOFF_LOCK_KEY, replayStream } from "@src/pipeline/modules";
import { runRangePipeline } from "@src/pipeline/range-pipeline";
import { RunnerInterruptedError } from "@src/pipeline/runner-interrupted-error";
import { retryTransient } from "@src/pipeline/transient-retry";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

const FETCH_RETRY_MAX_ATTEMPTS = 5;
const FETCH_RETRY_BASE_MS = 1_000;

/**
 * Replays one module's history from the raw block archive while live sync keeps the head fresh.
 * The `replay:<module>` checkpoint doubles as the ownership marker: while it exists, every full commit
 * leaves that module to the replay, so the replay can rewrite [from, head] without overlap. It catches
 * up in batches to the sync checkpoint and hands off the batch that ends exactly there, under the
 * handoff lock, so sync takes the module back with no gap. Without a sync checkpoint it runs to a
 * fixed end and completes on its own.
 */
@singleton()
export class ModuleReplayRunnerService {
  readonly #db: ChainDatabase;
  readonly #pool: RpcClientPool;
  readonly #decoder: BlockDecoderService;
  readonly #committer: BlockCommitterService;
  readonly #archive: BlockArchiveService;
  readonly #genesisImport: GenesisImportService;
  readonly #moduleReset: ModuleResetService;
  readonly #config: EnvConfig;
  readonly #logger: LoggerService;

  #stopped = false;
  #lastHash: Buffer | null = null;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(RpcClientPool) pool: RpcClientPool,
    @inject(BlockDecoderService) decoder: BlockDecoderService,
    @inject(BlockCommitterService) committer: BlockCommitterService,
    @inject(BlockArchiveService) archive: BlockArchiveService,
    @inject(GenesisImportService) genesisImport: GenesisImportService,
    @inject(ModuleResetService) moduleReset: ModuleResetService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#pool = pool;
    this.#decoder = decoder;
    this.#committer = committer;
    this.#archive = archive;
    this.#genesisImport = genesisImport;
    this.#moduleReset = moduleReset;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("REPLAY");
  }

  async start(): Promise<void> {
    let completed: boolean;

    try {
      completed = await this.#run();
    } catch (error) {
      if (this.#stopped) {
        throw new RunnerInterruptedError("Module replay stopped before the handoff", { cause: error });
      }
      throw error;
    }

    if (!completed) {
      throw new RunnerInterruptedError("Module replay stopped before the handoff");
    }
  }

  async dispose(): Promise<void> {
    this.#stopped = true;
  }

  async #run(): Promise<boolean> {
    const { BACKFILL_MODULE: module, BACKFILL_FROM_HEIGHT: fromHeight, BACKFILL_TO_HEIGHT: fixedEnd } = this.#config;
    if (module === undefined || fromHeight === undefined) {
      throw new Error("BACKFILL_MODULE and BACKFILL_FROM_HEIGHT are required for a module replay");
    }

    const stream = replayStream(module);
    const [marker, syncCheckpoint] = await Promise.all([this.#readCheckpoint(stream), this.#readCheckpoint(SYNC_STREAM)]);
    if (syncCheckpoint === null && fixedEnd === undefined) {
      throw new Error("BACKFILL_TO_HEIGHT is required for a module replay when no sync checkpoint exists");
    }
    if (syncCheckpoint !== null && fixedEnd !== undefined) {
      throw new Error("BACKFILL_TO_HEIGHT must be unset for a module replay while a sync checkpoint exists; the replay hands off at the sync checkpoint");
    }

    let cursor: number;
    if (marker !== null && !this.#config.BACKFILL_RESET_MODULE) {
      cursor = marker + 1;
      this.#logger.info({ event: "REPLAY_RESUMED", module, stream, nextHeight: cursor });
    } else {
      await this.#begin(stream, module, fromHeight);
      cursor = fromHeight;
    }

    if (module === "balance" && this.#config.GENESIS_IMPORT) {
      await this.#genesisImport.ensureSeeded(fromHeight);
    }
    await this.#seedContinuityHash(cursor);
    this.#archive.logState();

    while (!this.#stopped) {
      const target = fixedEnd ?? (await this.#readCheckpoint(SYNC_STREAM));
      if (target === null) {
        throw new Error("The sync checkpoint disappeared during the module replay");
      }

      if (cursor > target) {
        if (await this.#committer.handoffWithoutBlocks(stream, cursor - 1)) {
          this.#logCompleted(module, fromHeight, cursor - 1);
          return true;
        }
        continue;
      }

      const outcome = await this.#replayRange(cursor, target, stream, module);
      if (outcome.handoffCompleted) {
        this.#logCompleted(module, fromHeight, target);
        return true;
      }
      if (outcome.lastCommittedHeight < target) {
        return false;
      }
      cursor = target + 1;
    }

    return false;
  }

  /** The marker is written (and the module emptied) under the handoff lock, so no full commit already past its marker read can write the module after the reset. */
  async #begin(stream: string, module: ReplayableModule, fromHeight: number): Promise<void> {
    await this.#db.transaction(async tx => {
      await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${REPLAY_HANDOFF_LOCK_KEY})`));
      await tx
        .insert(IndexerState)
        .values({ stream, lastHeight: fromHeight - 1, updatedAt: new Date() })
        .onConflictDoUpdate({ target: IndexerState.stream, set: { lastHeight: fromHeight - 1, updatedAt: new Date() } });
      if (this.#config.BACKFILL_RESET_MODULE) {
        await this.#moduleReset.reset(tx, module);
      }
    });
    this.#logger.info({ event: "REPLAY_STARTED", module, stream, fromHeight, reset: this.#config.BACKFILL_RESET_MODULE });
  }

  async #replayRange(
    startHeight: number,
    endHeight: number,
    stream: string,
    module: ReplayableModule
  ): Promise<{ handoffCompleted: boolean; lastCommittedHeight: number }> {
    const modules = new Set<ReplayableModule>([module]);
    const source = new ArchiveBlockSource({ archive: this.#archive, pool: this.#pool, logger: this.#logger, startHeight, endHeight });
    let handoffCompleted = false;

    const progress = await runRangePipeline({
      startHeight,
      endHeight,
      concurrency: this.#config.BACKFILL_CONCURRENCY,
      batchSize: this.#config.BACKFILL_BATCH_SIZE,
      fetch: height => this.#fetchAndDecode(height, source),
      inspect: block => {
        this.#verifyContinuity(block);
        this.#lastHash = block.hash;
      },
      commit: async blocks => {
        const height = blocks[blocks.length - 1].height;
        const handoff = height === endHeight;
        const result = await this.#retryTransient(() => this.#committer.commitBatch(blocks, { stream, modules, handoff }), {
          event: "REPLAY_COMMIT_RETRY",
          height
        });
        handoffCompleted = handoff && result.handoffCompleted;
        this.#logger.info({ event: "REPLAY_PROGRESS", module, height, endHeight });
      },
      isStopped: () => this.#stopped
    });

    return { handoffCompleted, lastCommittedHeight: progress.lastCommittedHeight };
  }

  #logCompleted(module: ReplayableModule, fromHeight: number, handoffHeight: number): void {
    this.#logger.info({ event: "REPLAY_COMPLETED", module, fromHeight, handoffHeight });
  }

  async #retryTransient<T>(operation: () => Promise<T>, logContext: { event: string; height?: number }): Promise<T> {
    return await retryTransient(operation, { isStopped: () => this.#stopped, logger: this.#logger, logContext });
  }

  async #fetchAndDecode(height: number, source: ArchiveBlockSource): Promise<DecodedBlock> {
    const record = await retryWithBackoff(() => source.getRecord(height), {
      maxAttempts: FETCH_RETRY_MAX_ATTEMPTS,
      baseDelayMs: FETCH_RETRY_BASE_MS,
      shouldRethrow: () => this.#stopped,
      onRetry: (error, attempt, delayMs) => this.#logger.warn({ event: "REPLAY_FETCH_RETRY", height, attempt, delayMs, error })
    });
    return this.#decoder.decode(record.block, record.block_results);
  }

  #verifyContinuity(block: DecodedBlock): void {
    if (this.#lastHash && block.parentHash && !block.parentHash.equals(this.#lastHash)) {
      this.#logger.error({
        event: "REPLAY_CONTINUITY_BROKEN",
        height: block.height,
        expectedParentHash: this.#lastHash.toString("hex"),
        actualParentHash: block.parentHash.toString("hex")
      });
      throw new ChainContinuityError(`Parent hash mismatch at height ${block.height}; halting replay`);
    }
  }

  async #seedContinuityHash(startHeight: number): Promise<void> {
    const [previousBlock] = await this.#db
      .select()
      .from(Blocks)
      .where(eq(Blocks.height, startHeight - 1));
    this.#lastHash = previousBlock?.hash ?? null;
  }

  async #readCheckpoint(stream: string): Promise<number | null> {
    const [state] = await this.#db.select().from(IndexerState).where(eq(IndexerState.stream, stream));
    return state?.lastHeight ?? null;
  }
}
