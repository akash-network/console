import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { inject, singleton } from "tsyringe";

import { fetchRawBlock } from "@src/archive/archive-layout";
import { BlockArchiveService } from "@src/archive/block-archive.service";
import type { EnvConfig } from "@src/config/env.config";
import { Blocks, IndexerState } from "@src/db/schema";
import { GenesisImportService } from "@src/genesis/genesis-import.service";
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
import { StakingSnapshotService } from "@src/staking/staking-snapshot.service";

const PROGRESS_LOG_EVERY_BLOCKS = 100;

@singleton()
export class SyncRunnerService {
  readonly #db: ChainDatabase;
  readonly #pool: RpcClientPool;
  readonly #decoder: BlockDecoderService;
  readonly #committer: BlockCommitterService;
  readonly #archive: BlockArchiveService;
  readonly #genesisImport: GenesisImportService;
  readonly #stakingSnapshot: StakingSnapshotService;
  readonly #config: EnvConfig;
  readonly #logger: LoggerService;

  #stopped = false;
  #lastHash: Buffer | null = null;
  #lastSnapshotHeight: number | null = null;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(RpcClientPool) pool: RpcClientPool,
    @inject(BlockDecoderService) decoder: BlockDecoderService,
    @inject(BlockCommitterService) committer: BlockCommitterService,
    @inject(BlockArchiveService) archive: BlockArchiveService,
    @inject(GenesisImportService) genesisImport: GenesisImportService,
    @inject(StakingSnapshotService) stakingSnapshot: StakingSnapshotService,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#pool = pool;
    this.#decoder = decoder;
    this.#committer = committer;
    this.#archive = archive;
    this.#genesisImport = genesisImport;
    this.#stakingSnapshot = stakingSnapshot;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("SYNC");
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
  }

  async #run(): Promise<void> {
    const { height, resumed } = await this.#resolveStartHeight();

    if (this.#config.GENESIS_IMPORT) {
      await this.#seedGenesisOrWarn(height, resumed);
    }

    let nextHeight = height;
    this.#logger.info({ event: "SYNC_STARTED", network: this.#config.NETWORK, nextHeight });
    this.#archive.logState();

    while (!this.#stopped) {
      const tipHeight = await this.#retryTransient(() => this.#pool.getTipHeight(), { event: "SYNC_TIP_FETCH_RETRY" });

      if (nextHeight <= tipHeight) {
        while (nextHeight <= tipHeight && !this.#stopped) {
          const height = nextHeight;
          await this.#retryTransient(() => this.#syncBlock(height), { event: "SYNC_BLOCK_RETRY", height });
          nextHeight++;
        }
      }

      if (this.#stopped) {
        return;
      }

      // Snapshot after the observed tip is fully committed, even if a new block appears before the next poll.
      // Waiting until nextHeight > tip would skip the snapshot whenever live follow stays one block behind.
      await this.#maybeSnapshotStaking(nextHeight - 1);
      if (this.#stopped) {
        return;
      }
      await delay(this.#config.SYNC_POLL_INTERVAL_MS);
    }
  }

  /**
   * Genesis is seeded only on a fresh start; a resume is already past genesis and seeding mid-chain is refused
   * by design. Turning GENESIS_IMPORT on after an indexer already has a sync checkpoint would otherwise skip the
   * seed with no trace, so warn when the flag is set on a resume whose genesis was never seeded.
   */
  async #seedGenesisOrWarn(height: number, resumed: boolean): Promise<void> {
    if (!resumed) {
      await this.#genesisImport.ensureSeeded(height);
      return;
    }

    if (!(await this.#genesisImport.hasSeeded())) {
      this.#logger.warn({ event: "GENESIS_IMPORT_SKIPPED_RESUMED_WITHOUT_MARKER", height });
    }
  }

  async #retryTransient<T>(operation: () => Promise<T>, logContext: { event: string; height?: number }): Promise<T> {
    return await retryTransient(operation, { isStopped: () => this.#stopped, logger: this.#logger, logContext });
  }

  /**
   * Reconciles the validator set and delegations against the chain after sync has committed the tip it last
   * observed, so the snapshot reads current state. Throttled to one run per configured block interval. A failed
   * snapshot is logged and retried on the next interval rather than halting the sync it rides alongside.
   */
  async #maybeSnapshotStaking(head: number): Promise<void> {
    if (!this.#config.STAKING_SNAPSHOT_ENABLED || head < 1) {
      return;
    }
    if (this.#lastSnapshotHeight !== null && head - this.#lastSnapshotHeight < this.#config.STAKING_SNAPSHOT_INTERVAL_BLOCKS) {
      return;
    }

    try {
      await this.#stakingSnapshot.snapshot(head);
      this.#lastSnapshotHeight = head;
    } catch (error) {
      this.#logger.error({ event: "STAKING_SNAPSHOT_FAILED", height: head, error });
    }
  }

  /** The raw payloads are archived before decode and commit, so no block is ever committed without being archived and raw blocks survive even decoder bugs. */
  async #syncBlock(height: number): Promise<void> {
    const record = await fetchRawBlock(this.#pool, height);

    if (this.#archive.isEnabled()) {
      await this.#archive.putStagedBlockIfAbsent(record);
    }

    const decoded = this.#decoder.decode(record.block, record.block_results);

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

  /** `resumed` distinguishes continuing from an existing sync checkpoint from a fresh forward start, which gates whether the one-time genesis seed runs. */
  async #resolveStartHeight(): Promise<{ height: number; resumed: boolean }> {
    const [state] = await this.#db.select().from(IndexerState).where(eq(IndexerState.stream, SYNC_STREAM));

    if (state) {
      const [checkpointBlock] = await this.#db.select().from(Blocks).where(eq(Blocks.height, state.lastHeight));
      this.#lastHash = checkpointBlock?.hash ?? null;
      return { height: state.lastHeight + 1, resumed: true };
    }

    if (this.#config.SYNC_START_HEIGHT) {
      return { height: this.#config.SYNC_START_HEIGHT, resumed: false };
    }

    return { height: await this.#pool.getTipHeight(), resumed: false };
  }
}
