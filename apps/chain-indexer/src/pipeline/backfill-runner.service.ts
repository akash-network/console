import { eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { ArchiveBlockSource } from "@src/archive/archive-block-source";
import { BlockArchiveService } from "@src/archive/block-archive.service";
import type { EnvConfig } from "@src/config/env.config";
import { Blocks, IndexerState } from "@src/db/schema";
import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";
import { planBackfill } from "@src/pipeline/backfill-planner";
import { BlockCommitterService } from "@src/pipeline/block-committer.service";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import { ChainContinuityError } from "@src/pipeline/chain-continuity-error";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { RunnerInterruptedError } from "@src/pipeline/runner-interrupted-error";
import { retryTransient } from "@src/pipeline/transient-retry";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

const FETCH_RETRY_MAX_ATTEMPTS = 5;
const FETCH_RETRY_BASE_MS = 1_000;

@singleton()
export class BackfillRunnerService {
  readonly #db: ChainDatabase;
  readonly #pool: RpcClientPool;
  readonly #decoder: BlockDecoderService;
  readonly #committer: BlockCommitterService;
  readonly #archive: BlockArchiveService;
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
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#pool = pool;
    this.#decoder = decoder;
    this.#committer = committer;
    this.#archive = archive;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("BACKFILL");
  }

  async start(): Promise<void> {
    let completed: boolean;

    try {
      completed = await this.#run();
    } catch (error) {
      if (this.#stopped) {
        throw new RunnerInterruptedError("Backfill stopped before completing the range", { cause: error });
      }
      throw error;
    }

    if (!completed) {
      throw new RunnerInterruptedError("Backfill stopped before completing the range");
    }
  }

  async dispose(): Promise<void> {
    this.#stopped = true;
  }

  async #run(): Promise<boolean> {
    const { BACKFILL_FROM_HEIGHT: fromHeight, BACKFILL_TO_HEIGHT: toHeight } = this.#config;

    if (fromHeight === undefined || toHeight === undefined) {
      throw new Error("BACKFILL_FROM_HEIGHT and BACKFILL_TO_HEIGHT are required for the backfill role");
    }

    const stream = `backfill:${fromHeight}-${toHeight}`;
    const [checkpointHeight, tipHeight] = await Promise.all([
      this.#retryTransient(() => this.#getCheckpointHeight(stream), { event: "BACKFILL_CHECKPOINT_READ_RETRY" }),
      this.#retryTransient(() => this.#pool.getTipHeight(), { event: "BACKFILL_TIP_FETCH_RETRY" })
    ]);
    const plan = planBackfill({ fromHeight, toHeight, checkpointHeight, tipHeight });

    if (plan.kind === "invalid") {
      this.#logger.error({ event: "BACKFILL_INVALID_RANGE", reason: plan.reason });
      throw new Error(plan.reason);
    }

    if (plan.kind === "already-complete") {
      this.#logger.info({ event: "BACKFILL_ALREADY_COMPLETE", stream, checkpointHeight });
      return true;
    }

    await this.#seedContinuityHash(plan.startHeight, checkpointHeight !== null);
    this.#logger.info({ event: "BACKFILL_STARTED", network: this.#config.NETWORK, stream, startHeight: plan.startHeight, endHeight: plan.endHeight });
    this.#archive.logState();

    const source = new ArchiveBlockSource({
      archive: this.#archive,
      pool: this.#pool,
      logger: this.#logger,
      startHeight: plan.startHeight,
      endHeight: plan.endHeight
    });

    return await this.#backfillRange(plan.startHeight, plan.endHeight, stream, source);
  }

  /**
   * Fetches up to BACKFILL_CONCURRENCY blocks in parallel while consuming heights strictly in
   * order, so batches handed to the committer are contiguous and ordered by construction.
   * Prefetched promises get a no-op catch at insertion: a rejection settling before the loop
   * reaches its height would otherwise crash the process as an unhandled rejection; the real
   * rejection still surfaces when the loop awaits that height.
   *
   * Returns whether the whole range committed. Completion is tracked by the last committed height
   * rather than the stopped flag, so a shutdown landing during the final commit still reports the
   * range as done instead of failing the Job for a spurious retry.
   */
  async #backfillRange(startHeight: number, endHeight: number, stream: string, source: ArchiveBlockSource): Promise<boolean> {
    const startedAt = Date.now();
    const inflight = new Map<number, Promise<DecodedBlock>>();
    let fetchHead = startHeight;
    let blocksCommitted = 0;
    let transactionsCommitted = 0;
    let lastCommittedHeight = startHeight - 1;
    let batch: DecodedBlock[] = [];

    const fillFetchWindow = () => {
      while (fetchHead <= endHeight && inflight.size < this.#config.BACKFILL_CONCURRENCY) {
        const height = fetchHead;
        const prefetched = this.#fetchAndDecode(height, source);
        prefetched.catch(() => undefined);
        inflight.set(height, prefetched);
        fetchHead++;
      }
    };

    try {
      for (let height = startHeight; height <= endHeight && !this.#stopped; height++) {
        fillFetchWindow();
        const decoded = await inflight.get(height)!;
        inflight.delete(height);

        this.#verifyContinuity(decoded);
        this.#lastHash = decoded.hash;
        batch.push(decoded);
        fillFetchWindow();

        if (batch.length >= this.#config.BACKFILL_BATCH_SIZE || height === endHeight) {
          const currentBatch = batch;
          await this.#retryTransient(() => this.#committer.commitBatch(currentBatch, { stream }), { event: "BACKFILL_COMMIT_RETRY", height });
          blocksCommitted += batch.length;
          transactionsCommitted += batch.reduce((sum, block) => sum + block.transactions.length, 0);
          lastCommittedHeight = height;
          batch = [];
          this.#logger.info({ event: "BACKFILL_PROGRESS", height, endHeight, blocksCommitted });
        }
      }
    } finally {
      await Promise.allSettled([...inflight.values()]);
    }

    if (lastCommittedHeight < endHeight) {
      return false;
    }

    const durationMs = Date.now() - startedAt;
    this.#logger.info({
      event: "BACKFILL_COMPLETED",
      stream,
      startHeight,
      endHeight,
      blocksCommitted,
      transactionsCommitted,
      durationMs,
      blocksPerSecond: durationMs > 0 ? Math.round((blocksCommitted / durationMs) * 1_000 * 100) / 100 : blocksCommitted
    });

    return true;
  }

  /** Retriable steps (checkpoint reads, tip fetches, idempotent batch commits) survive transient blips instead of failing the whole multi-hour Job; fatal errors propagate. */
  async #retryTransient<T>(operation: () => Promise<T>, logContext: { event: string; height?: number }): Promise<T> {
    return await retryTransient(operation, { isStopped: () => this.#stopped, logger: this.#logger, logContext });
  }

  /** A pool AggregateError means every RPC endpoint already failed once, so retries back off before another full sweep. */
  async #fetchAndDecode(height: number, source: ArchiveBlockSource): Promise<DecodedBlock> {
    return await retryWithBackoff(
      async () => {
        const record = await source.getRecord(height);
        return this.#decoder.decode(record.block, record.block_results);
      },
      {
        maxAttempts: FETCH_RETRY_MAX_ATTEMPTS,
        baseDelayMs: FETCH_RETRY_BASE_MS,
        shouldRethrow: () => this.#stopped,
        onRetry: (error, attempt, delayMs) => this.#logger.warn({ event: "BACKFILL_FETCH_RETRY", height, attempt, delayMs, error })
      }
    );
  }

  #verifyContinuity(block: DecodedBlock): void {
    if (this.#lastHash && block.parentHash && !block.parentHash.equals(this.#lastHash)) {
      this.#logger.error({
        event: "BACKFILL_CONTINUITY_BROKEN",
        height: block.height,
        expectedParentHash: this.#lastHash.toString("hex"),
        actualParentHash: block.parentHash.toString("hex")
      });
      throw new ChainContinuityError(`Parent hash mismatch at height ${block.height}; halting backfill`);
    }
  }

  /**
   * The parent-hash chain is seeded from the block before the start height. On resume that block
   * was committed by this stream's checkpoint and must exist; on a fresh start it may have been
   * committed by sync or another backfill, and its absence just leaves the first block unverified.
   */
  async #seedContinuityHash(startHeight: number, isResume: boolean): Promise<void> {
    const [previousBlock] = await this.#retryTransient(
      () =>
        this.#db
          .select()
          .from(Blocks)
          .where(eq(Blocks.height, startHeight - 1)),
      { event: "BACKFILL_SEED_READ_RETRY", height: startHeight - 1 }
    );

    if (previousBlock) {
      this.#lastHash = previousBlock.hash;
      return;
    }

    if (isResume) {
      throw new Error(`Checkpoint block ${startHeight - 1} is missing; cannot verify continuity on resume`);
    }

    this.#lastHash = null;
  }

  async #getCheckpointHeight(stream: string): Promise<number | null> {
    const [state] = await this.#db.select().from(IndexerState).where(eq(IndexerState.stream, stream));
    return state?.lastHeight ?? null;
  }
}
