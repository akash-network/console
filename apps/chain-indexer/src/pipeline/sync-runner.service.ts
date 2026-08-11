import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { PgAdvisoryLeaderLock } from "@src/db/pg-advisory-leader-lock";
import { PgClientService } from "@src/db/pg-client.service";
import { Blocks, IndexerState } from "@src/db/schema";
import { BlockCommitterService, SYNC_STREAM } from "@src/pipeline/block-committer.service";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import { ChainContinuityError } from "@src/pipeline/chain-continuity-error";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { retryTransient } from "@src/pipeline/transient-retry";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

/** Arbitrary but fixed application-wide key for the sync leader pg advisory lock. */
const SYNC_LEADER_LOCK_KEY = 7_431_001;
const PROGRESS_LOG_EVERY_BLOCKS = 100;
const LEADERSHIP_CHECK_EVERY_BLOCKS = 100;

@singleton()
export class SyncRunnerService {
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
    this.#logger.setContext("SYNC");
    this.#leaderLock = new PgAdvisoryLeaderLock({ client: pgClient.client, lockKey: SYNC_LEADER_LOCK_KEY, logger: this.#logger, eventPrefix: "SYNC" });
  }

  async start(): Promise<void> {
    try {
      await this.#run();
    } catch (error) {
      if (this.#stopped) {
        this.#logger.info({ event: "SYNC_STOPPED_DURING_SHUTDOWN" });
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
    await this.#leaderLock.acquire(() => this.#stopped);

    if (this.#stopped) {
      return;
    }

    let nextHeight = await this.#resolveStartHeight();
    this.#logger.info({ event: "SYNC_STARTED", network: this.#config.NETWORK, nextHeight });

    while (!this.#stopped) {
      await this.#leaderLock.assertHeld();
      const tipHeight = await this.#retryTransient(() => this.#getTipHeight(), { event: "SYNC_TIP_FETCH_RETRY" });

      if (nextHeight > tipHeight) {
        await delay(this.#config.SYNC_POLL_INTERVAL_MS);
        continue;
      }

      while (nextHeight <= tipHeight && !this.#stopped) {
        const height = nextHeight;
        await this.#retryTransient(() => this.#syncBlock(height), { event: "SYNC_BLOCK_RETRY", height });
        nextHeight++;

        if (nextHeight % LEADERSHIP_CHECK_EVERY_BLOCKS === 0) {
          await this.#leaderLock.assertHeld();
        }
      }
    }
  }

  async #retryTransient<T>(operation: () => Promise<T>, logContext: { event: string; height?: number }): Promise<T> {
    return await retryTransient(operation, { isStopped: () => this.#stopped, logger: this.#logger, logContext });
  }

  async #syncBlock(height: number): Promise<void> {
    const [block, blockResults] = await Promise.all([this.#pool.getBlock(height), this.#pool.getBlockResults(height)]);
    const decoded = this.#decoder.decode(block, blockResults);

    this.#verifyContinuity(decoded);
    await this.#committer.commit(decoded);
    this.#lastHash = decoded.hash;

    if (height % PROGRESS_LOG_EVERY_BLOCKS === 0) {
      this.#logger.info({ event: "SYNC_PROGRESS", height, txCount: decoded.transactions.length });
    } else {
      this.#logger.debug({ event: "BLOCK_COMMITTED", height, txCount: decoded.transactions.length });
    }
  }

  #verifyContinuity(block: DecodedBlock): void {
    if (this.#lastHash && block.parentHash && !block.parentHash.equals(this.#lastHash)) {
      this.#logger.error({
        event: "CHAIN_CONTINUITY_BROKEN",
        height: block.height,
        expectedParentHash: this.#lastHash.toString("hex"),
        actualParentHash: block.parentHash.toString("hex")
      });
      throw new ChainContinuityError(`Parent hash mismatch at height ${block.height}; halting sync`);
    }
  }

  async #resolveStartHeight(): Promise<number> {
    const [state] = await this.#db.select().from(IndexerState).where(eq(IndexerState.stream, SYNC_STREAM));

    if (state) {
      const [checkpointBlock] = await this.#db.select().from(Blocks).where(eq(Blocks.height, state.lastHeight));
      this.#lastHash = checkpointBlock?.hash ?? null;
      return state.lastHeight + 1;
    }

    if (this.#config.SYNC_START_HEIGHT) {
      return this.#config.SYNC_START_HEIGHT;
    }

    return await this.#getTipHeight();
  }

  async #getTipHeight(): Promise<number> {
    const status = await this.#pool.getStatus();
    return parseInt(status.sync_info.latest_block_height);
  }
}
