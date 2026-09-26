import { eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { ArchiveBlockSource } from "@src/archive/archive-block-source";
import type { RawBlockRecord } from "@src/archive/archive-layout";
import { CHUNK_SIZE } from "@src/archive/archive-layout";
import { BlockArchiveService } from "@src/archive/block-archive.service";
import type { EnvConfig } from "@src/config/env.config";
import { DeferredIndexService } from "@src/db/deferred-index.service";
import { Blocks, IndexerState } from "@src/db/schema";
import { GenesisImportService } from "@src/genesis/genesis-import.service";
import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";
import { planBackfill } from "@src/pipeline/backfill-planner";
import { BlockCommitterService } from "@src/pipeline/block-committer.service";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import { ChainContinuityError } from "@src/pipeline/chain-continuity-error";
import { advanceCheckpoint } from "@src/pipeline/checkpoint";
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

interface BackfillProgress {
  blocksCommitted: number;
  transactionsCommitted: number;
  lastCommittedHeight: number;
}

@singleton()
export class BackfillRunnerService {
  readonly #db: ChainDatabase;
  readonly #pool: RpcClientPool;
  readonly #decoder: BlockDecoderService;
  readonly #committer: BlockCommitterService;
  readonly #archive: BlockArchiveService;
  readonly #deferredIndexes: DeferredIndexService;
  readonly #genesisImport: GenesisImportService;
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
    @inject(DeferredIndexService) deferredIndexes: DeferredIndexService,
    @inject(GenesisImportService) genesisImport: GenesisImportService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#pool = pool;
    this.#decoder = decoder;
    this.#committer = committer;
    this.#archive = archive;
    this.#deferredIndexes = deferredIndexes;
    this.#genesisImport = genesisImport;
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

    const archiveOnly = this.#config.BACKFILL_ARCHIVE_ONLY;
    const stream = `${archiveOnly ? "archive" : "backfill"}:${fromHeight}-${toHeight}`;
    const replay = this.#config.BACKFILL_REPLAY;
    const deferIndexes = !archiveOnly && this.#config.BACKFILL_DEFER_INDEXES;
    if (!archiveOnly && !deferIndexes) {
      await this.#deferredIndexes.restore();
    }
    const [checkpointHeight, tipHeight] = await Promise.all([
      this.#retryTransient(() => this.#getCheckpointHeight(stream), { event: "BACKFILL_CHECKPOINT_READ_RETRY" }),
      this.#retryTransient(() => this.#pool.getTipHeight(), { event: "BACKFILL_TIP_FETCH_RETRY" })
    ]);
    const plan = planBackfill({ fromHeight, toHeight, checkpointHeight, tipHeight, replay });

    if (plan.kind === "invalid") {
      this.#logger.error({ event: "BACKFILL_INVALID_RANGE", reason: plan.reason });
      throw new Error(plan.reason);
    }

    if (plan.kind === "already-complete") {
      this.#logger.info({ event: "BACKFILL_ALREADY_COMPLETE", stream, checkpointHeight });
      return true;
    }

    if (deferIndexes) {
      await this.#deferredIndexes.defer();
    }

    const source = new ArchiveBlockSource({
      archive: this.#archive,
      pool: this.#pool,
      logger: this.#logger,
      startHeight: plan.startHeight,
      endHeight: plan.endHeight
    });

    if (archiveOnly) {
      this.#logger.info({ event: "ARCHIVE_BUILD_STARTED", network: this.#config.NETWORK, stream, startHeight: plan.startHeight, endHeight: plan.endHeight });
      this.#archive.logState();
      return await this.#archiveRange(plan.startHeight, plan.endHeight, stream, source);
    }

    if (this.#config.GENESIS_IMPORT && checkpointHeight === null) {
      await this.#genesisImport.ensureSeeded(fromHeight);
    }
    await this.#seedContinuityHash(plan.startHeight, !replay && checkpointHeight !== null);
    this.#logger.info({ event: "BACKFILL_STARTED", network: this.#config.NETWORK, stream, startHeight: plan.startHeight, endHeight: plan.endHeight, replay });
    this.#archive.logState();

    return await this.#backfillRange(plan.startHeight, plan.endHeight, stream, source);
  }

  /**
   * Fetches raw blocks into the archive without decoding or committing them, so several Jobs over
   * disjoint ranges can build the archive in parallel against different RPC nodes before one ordered
   * backfill fills the database from it. The checkpoint advances only at chunk boundaries (and the
   * range end), where the source has flushed every block it handed out, so a crash can never leave a
   * checkpointed height that was only buffered. Only the raw parent-hash chain is verified here; the
   * archive-fed backfill re-verifies every decoded block.
   */
  async #archiveRange(startHeight: number, endHeight: number, stream: string, source: ArchiveBlockSource): Promise<boolean> {
    const startedAt = Date.now();
    const inflight = new Map<number, Promise<RawBlockRecord>>();
    let fetchHead = startHeight;
    let lastCheckpointedHeight = startHeight - 1;
    let lastRawHash: string | null = null;

    const fillFetchWindow = () => {
      while (fetchHead <= endHeight && inflight.size < this.#config.BACKFILL_CONCURRENCY) {
        const height = fetchHead;
        const prefetched = this.#fetchRecord(height, source);
        prefetched.catch(() => undefined);
        inflight.set(height, prefetched);
        fetchHead++;
      }
    };

    try {
      for (let height = startHeight; height <= endHeight && !this.#stopped; height++) {
        fillFetchWindow();
        const record = await inflight.get(height)!;
        inflight.delete(height);

        this.#verifyRawContinuity(record, lastRawHash);
        lastRawHash = record.block.block_id.hash;
        fillFetchWindow();

        if (height % CHUNK_SIZE === CHUNK_SIZE - 1 || height === endHeight) {
          await this.#retryTransient(() => advanceCheckpoint(this.#db, stream, height), { event: "ARCHIVE_CHECKPOINT_RETRY", height });
          lastCheckpointedHeight = height;
          this.#logger.info({ event: "ARCHIVE_BUILD_PROGRESS", height, endHeight });
        }
      }
    } finally {
      await Promise.allSettled([...inflight.values()]);
    }

    if (lastCheckpointedHeight < endHeight) {
      return false;
    }

    const blocksArchived = endHeight - startHeight + 1;
    const durationMs = Date.now() - startedAt;
    this.#logger.info({
      event: "ARCHIVE_BUILD_COMPLETED",
      stream,
      startHeight,
      endHeight,
      blocksArchived,
      durationMs,
      blocksPerSecond: durationMs > 0 ? Math.round((blocksArchived / durationMs) * 1_000 * 100) / 100 : blocksArchived
    });

    return true;
  }

  #verifyRawContinuity(record: RawBlockRecord, lastRawHash: string | null): void {
    const parentHash = record.block.block.header.last_block_id?.hash;

    if (lastRawHash && parentHash && parentHash.toLowerCase() !== lastRawHash.toLowerCase()) {
      this.#logger.error({ event: "ARCHIVE_CONTINUITY_BROKEN", height: record.height, expectedParentHash: lastRawHash, actualParentHash: parentHash });
      throw new ChainContinuityError(`Parent hash mismatch at height ${record.height}; halting backfill`);
    }
  }

  /**
   * Two-stage pipeline: up to BACKFILL_CONCURRENCY blocks are fetched and decoded in parallel while
   * heights are consumed strictly in order, and each full batch commits detached so the next batch
   * is assembled while it lands. At most one commit is in flight, since batch N+1's writes depend on
   * batch N being committed. Prefetch and commit promises get a no-op catch at creation: a rejection
   * settling before the loop awaits it would otherwise crash the process as an unhandled rejection;
   * the real rejection still surfaces when the loop awaits it.
   *
   * Returns whether the whole range committed. Completion is tracked by the last committed height
   * rather than the stopped flag, so a shutdown landing during the final commit still reports the
   * range as done instead of failing the Job for a spurious retry.
   */
  async #backfillRange(startHeight: number, endHeight: number, stream: string, source: ArchiveBlockSource): Promise<boolean> {
    const startedAt = Date.now();
    const inflight = new Map<number, Promise<DecodedBlock>>();
    const progress: BackfillProgress = { blocksCommitted: 0, transactionsCommitted: 0, lastCommittedHeight: startHeight - 1 };
    let fetchHead = startHeight;
    let batch: DecodedBlock[] = [];
    let pendingCommit: Promise<void> | null = null;
    let commitFailed = false;

    const fillFetchWindow = () => {
      while (fetchHead <= endHeight && inflight.size < this.#config.BACKFILL_CONCURRENCY) {
        const height = fetchHead;
        const prefetched = this.#fetchAndDecode(height, source);
        prefetched.catch(() => undefined);
        inflight.set(height, prefetched);
        fetchHead++;
      }
    };

    const commitDetached = (blocks: DecodedBlock[]) => {
      const commit = this.#commitBatch(blocks, endHeight, stream, progress);
      commit.catch(() => {
        commitFailed = true;
      });
      return commit;
    };

    try {
      for (let height = startHeight; height <= endHeight && !this.#stopped && !commitFailed; height++) {
        fillFetchWindow();
        const decoded = await inflight.get(height)!;
        inflight.delete(height);

        this.#verifyContinuity(decoded);
        this.#lastHash = decoded.hash;
        batch.push(decoded);
        fillFetchWindow();

        if (batch.length >= this.#config.BACKFILL_BATCH_SIZE || height === endHeight) {
          if (pendingCommit) {
            await pendingCommit;
          }
          pendingCommit = commitDetached(batch);
          batch = [];
        }
      }

      if (pendingCommit) {
        await pendingCommit;
      }
    } catch (error) {
      throw await this.#preferCommitFailure(error, pendingCommit);
    } finally {
      await Promise.allSettled([...inflight.values(), pendingCommit]);
    }

    if (progress.lastCommittedHeight < endHeight) {
      return false;
    }

    const durationMs = Date.now() - startedAt;
    this.#logger.info({
      event: "BACKFILL_COMPLETED",
      stream,
      startHeight,
      endHeight,
      blocksCommitted: progress.blocksCommitted,
      transactionsCommitted: progress.transactionsCommitted,
      durationMs,
      blocksPerSecond: durationMs > 0 ? Math.round((progress.blocksCommitted / durationMs) * 1_000 * 100) / 100 : progress.blocksCommitted
    });

    return true;
  }

  async #commitBatch(blocks: DecodedBlock[], endHeight: number, stream: string, progress: BackfillProgress): Promise<void> {
    const height = blocks[blocks.length - 1].height;
    await this.#retryTransient(() => this.#committer.commitBatch(blocks, { stream }), { event: "BACKFILL_COMMIT_RETRY", height });
    progress.blocksCommitted += blocks.length;
    progress.transactionsCommitted += blocks.reduce((sum, block) => sum + block.transactions.length, 0);
    progress.lastCommittedHeight = height;
    this.#logger.info({ event: "BACKFILL_PROGRESS", height, endHeight, blocksCommitted: progress.blocksCommitted });
  }

  /** A run with the flag drops (or keeps dropped) the deferrable indexes; a run without it rebuilds whatever an earlier run left deferred, so a heavy multi-range backfill pays for the indexes once. */
  /** A detached commit that is still rejecting when a later step throws is the real cause, so it is reported and thrown instead of the error that merely followed it. */
  async #preferCommitFailure(error: unknown, pendingCommit: Promise<void> | null): Promise<unknown> {
    if (!pendingCommit) {
      return error;
    }
    const [commit] = await Promise.allSettled([pendingCommit]);
    if (commit.status !== "rejected" || commit.reason === error) {
      return error;
    }
    this.#logger.error({ event: "BACKFILL_COMMIT_FAILED", error: commit.reason, followedBy: error });
    return commit.reason;
  }

  /** Retriable steps (checkpoint reads, tip fetches, idempotent batch commits) survive transient blips instead of failing the whole multi-hour Job; fatal errors propagate. */
  async #retryTransient<T>(operation: () => Promise<T>, logContext: { event: string; height?: number }): Promise<T> {
    return await retryTransient(operation, { isStopped: () => this.#stopped, logger: this.#logger, logContext });
  }

  async #fetchAndDecode(height: number, source: ArchiveBlockSource): Promise<DecodedBlock> {
    const record = await this.#fetchRecord(height, source);
    return this.#decoder.decode(record.block, record.block_results);
  }

  /** A pool AggregateError means every RPC endpoint already failed once, so retries back off before another full sweep. */
  async #fetchRecord(height: number, source: ArchiveBlockSource): Promise<RawBlockRecord> {
    return await retryWithBackoff(() => source.getRecord(height), {
      maxAttempts: FETCH_RETRY_MAX_ATTEMPTS,
      baseDelayMs: FETCH_RETRY_BASE_MS,
      shouldRethrow: () => this.#stopped,
      onRetry: (error, attempt, delayMs) => this.#logger.warn({ event: "BACKFILL_FETCH_RETRY", height, attempt, delayMs, error })
    });
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
