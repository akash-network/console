import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { PgAdvisoryLeaderLock } from "@src/db/pg-advisory-leader-lock";
import { PgClientService } from "@src/db/pg-client.service";
import { Blocks, IndexerState } from "@src/db/schema";
import { planBackfill } from "@src/pipeline/backfill-planner";
import { BlockCommitterService } from "@src/pipeline/block-committer.service";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { ChainContinuityError } from "@src/pipeline/sync-runner.service";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

/** Arbitrary but fixed application-wide key for the backfill leader pg advisory lock; distinct from the sync leader key so a backfill never contends with live sync. */
const BACKFILL_LEADER_LOCK_KEY = 7_431_002;
const FETCH_RETRY_MAX_ATTEMPTS = 5;
const FETCH_RETRY_BASE_MS = 1_000;

@singleton()
export class BackfillRunnerService {
  readonly #db: ChainDatabase;
  readonly #pool: RpcClientPool;
  readonly #decoder: BlockDecoderService;
  readonly #committer: BlockCommitterService;
  readonly #config: EnvConfig;
  readonly #logger: LoggerService;
  readonly #leaderLock: PgAdvisoryLeaderLock;

  #stopped = false;
  #lastHash: Buffer | null = null;

  constructor(
    @inject(PgClientService) pgClient: PgClientService,
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(RpcClientPool) pool: RpcClientPool,
    @inject(BlockDecoderService) decoder: BlockDecoderService,
    @inject(BlockCommitterService) committer: BlockCommitterService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#pool = pool;
    this.#decoder = decoder;
    this.#committer = committer;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("BACKFILL");
    this.#leaderLock = new PgAdvisoryLeaderLock({
      client: pgClient.client,
      lockKey: BACKFILL_LEADER_LOCK_KEY,
      logger: this.#logger,
      eventPrefix: "BACKFILL"
    });
  }

  async start(): Promise<void> {
    try {
      await this.#run();
    } catch (error) {
      if (this.#stopped) {
        this.#logger.info({ event: "BACKFILL_STOPPED_DURING_SHUTDOWN" });
        return;
      }
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.#stopped = true;
    this.#leaderLock.release();
  }

  async #run(): Promise<void> {
    const { BACKFILL_FROM_HEIGHT: fromHeight, BACKFILL_TO_HEIGHT: toHeight } = this.#config;

    if (fromHeight === undefined || toHeight === undefined) {
      throw new Error("BACKFILL_FROM_HEIGHT and BACKFILL_TO_HEIGHT are required for the backfill role");
    }

    await this.#leaderLock.acquire(() => this.#stopped);

    if (this.#stopped) {
      return;
    }

    const stream = `backfill:${fromHeight}-${toHeight}`;
    const checkpointHeight = await this.#getCheckpointHeight(stream);
    const tipHeight = await this.#getTipHeight();
    const plan = planBackfill({ fromHeight, toHeight, checkpointHeight, tipHeight });

    if (plan.kind === "invalid") {
      this.#logger.error({ event: "BACKFILL_INVALID_RANGE", reason: plan.reason });
      throw new Error(plan.reason);
    }

    if (plan.kind === "already-complete") {
      this.#logger.info({ event: "BACKFILL_ALREADY_COMPLETE", stream, checkpointHeight });
      return;
    }

    await this.#seedContinuityHash(plan.startHeight, checkpointHeight !== null);
    this.#logger.info({ event: "BACKFILL_STARTED", network: this.#config.NETWORK, stream, startHeight: plan.startHeight, endHeight: plan.endHeight });
    await this.#backfillRange(plan.startHeight, plan.endHeight, stream);
  }

  /**
   * Fetches up to BACKFILL_CONCURRENCY blocks in parallel while consuming heights strictly in
   * order, so batches handed to the committer are contiguous and ordered by construction.
   * Prefetched promises get a no-op catch at insertion: a rejection settling before the loop
   * reaches its height would otherwise crash the process as an unhandled rejection; the real
   * rejection still surfaces when the loop awaits that height.
   */
  async #backfillRange(startHeight: number, endHeight: number, stream: string): Promise<void> {
    const startedAt = Date.now();
    const inflight = new Map<number, Promise<DecodedBlock>>();
    let fetchHead = startHeight;
    let blocksCommitted = 0;
    let transactionsCommitted = 0;
    let batch: DecodedBlock[] = [];

    const fillFetchWindow = () => {
      while (fetchHead <= endHeight && inflight.size < this.#config.BACKFILL_CONCURRENCY) {
        const height = fetchHead;
        const prefetched = this.#fetchAndDecode(height);
        prefetched.catch(() => undefined);
        inflight.set(height, prefetched);
        fetchHead++;
      }
    };

    try {
      for (let height = startHeight; height <= endHeight && !this.#stopped; height++) {
        fillFetchWindow();
        const decoded = await (inflight.get(height) ?? this.#fetchAndDecode(height));
        inflight.delete(height);

        this.#verifyContinuity(decoded);
        this.#lastHash = decoded.hash;
        batch.push(decoded);
        fillFetchWindow();

        if (batch.length >= this.#config.BACKFILL_BATCH_SIZE || height === endHeight) {
          await this.#leaderLock.assertHeld();
          await this.#committer.commitBatch(batch, { stream });
          blocksCommitted += batch.length;
          transactionsCommitted += batch.reduce((sum, block) => sum + block.transactions.length, 0);
          batch = [];
          this.#logger.info({ event: "BACKFILL_PROGRESS", height, endHeight, blocksCommitted });
        }
      }
    } finally {
      await Promise.allSettled([...inflight.values()]);
    }

    if (this.#stopped) {
      return;
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
  }

  /** A pool AggregateError means every RPC endpoint already failed once, so retries back off before another full sweep. */
  async #fetchAndDecode(height: number): Promise<DecodedBlock> {
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        const [block, blockResults] = await Promise.all([this.#pool.getBlock(height), this.#pool.getBlockResults(height)]);
        return this.#decoder.decode(block, blockResults);
      } catch (error) {
        if (this.#stopped || attempt >= FETCH_RETRY_MAX_ATTEMPTS) {
          throw error;
        }

        const delayMs = FETCH_RETRY_BASE_MS * 2 ** (attempt - 1);
        this.#logger.warn({ event: "BACKFILL_FETCH_RETRY", height, attempt, delayMs, error });
        await delay(delayMs);
      }
    }
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
    const [previousBlock] = await this.#db
      .select()
      .from(Blocks)
      .where(eq(Blocks.height, startHeight - 1));

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

  async #getTipHeight(): Promise<number> {
    const status = await this.#pool.getStatus();
    return parseInt(status.sync_info.latest_block_height);
  }
}
