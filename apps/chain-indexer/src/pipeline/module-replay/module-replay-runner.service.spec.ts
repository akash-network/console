import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import { IndexerState } from "@src/db/schema";
import type { GenesisImportService } from "@src/genesis/genesis-import.service";
import type { BlockCommitterService, CommitOptions } from "@src/pipeline/block-committer.service";
import type { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { ModuleReplayRunnerService } from "@src/pipeline/module-replay/module-replay-runner.service";
import type { ModuleResetService } from "@src/pipeline/module-replay/module-reset.service";
import type { ReplayableModule } from "@src/pipeline/modules";
import { REPLAY_HANDOFF_LOCK_KEY } from "@src/pipeline/modules";
import { RunnerInterruptedError } from "@src/pipeline/runner-interrupted-error";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcBlockResult } from "@src/rpc/rpc-types";

describe(ModuleReplayRunnerService.name, () => {
  it("starts a fresh replay under the handoff lock, records the marker below the range start and resets the module when asked", async () => {
    const { runner, executed, markerUpserts, moduleReset, resetCallsAtFirstLock } = setup({ module: "provider", fromHeight: 1, toHeight: 3, reset: true });

    await runner.start();

    expect(renderSql(executed[0]).sql).toBe(`SELECT pg_advisory_xact_lock(${REPLAY_HANDOFF_LOCK_KEY})`);
    expect(markerUpserts[0]).toEqual({ table: IndexerState, rows: expect.objectContaining({ stream: "replay:provider", lastHeight: 0 }) });
    expect(moduleReset.reset).toHaveBeenCalledWith(expect.anything(), "provider");
    expect(resetCallsAtFirstLock()).toBe(0);
  });

  it("resumes from the marker without resetting", async () => {
    const { runner, pool, moduleReset, markerUpserts } = setup({ module: "provider", fromHeight: 1, toHeight: 6, marker: 3 });

    await runner.start();

    expect(moduleReset.reset).not.toHaveBeenCalled();
    expect(markerUpserts).toEqual([]);
    expect(pool.getBlock).not.toHaveBeenCalledWith(3);
    expect(pool.getBlock).toHaveBeenCalledWith(4);
  });

  it("replays to the fixed end and completes when no sync has ever run", async () => {
    const { runner, commits, logger } = setup({ module: "provider", fromHeight: 1, toHeight: 5, batchSize: 2 });

    await runner.start();

    expect(commits.map(commit => [commit.heights, commit.options.handoff ?? false])).toEqual([
      [[1, 2], false],
      [[3, 4], false],
      [[5], true]
    ]);
    expect(commits.every(commit => commit.options.stream === "replay:provider" && [...(commit.options.modules ?? [])].join() === "provider")).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "REPLAY_COMPLETED", module: "provider", handoffHeight: 5 }));
  });

  it("fails before touching anything when no sync checkpoint exists and BACKFILL_TO_HEIGHT is unset", async () => {
    const { runner, moduleReset, pool } = setup({ module: "provider", fromHeight: 1, reset: true });

    await expect(runner.start()).rejects.toThrow("BACKFILL_TO_HEIGHT is required");
    expect(moduleReset.reset).not.toHaveBeenCalled();
    expect(pool.getBlock).not.toHaveBeenCalled();
  });

  it("fails before touching anything when BACKFILL_TO_HEIGHT is set while a sync checkpoint exists", async () => {
    const { runner, moduleReset } = setup({ module: "provider", fromHeight: 1, toHeight: 5, syncCheckpoints: [10] });

    await expect(runner.start()).rejects.toThrow("BACKFILL_TO_HEIGHT must be unset");
    expect(moduleReset.reset).not.toHaveBeenCalled();
  });

  it("catches up to the sync checkpoint in batches and hands off the batch that ends there", async () => {
    const { runner, commits, logger } = setup({ module: "gov", fromHeight: 1, batchSize: 4, syncCheckpoints: [10] });

    await runner.start();

    expect(commits.map(commit => [commit.heights, commit.options.handoff ?? false])).toEqual([
      [[1, 2, 3, 4], false],
      [[5, 6, 7, 8], false],
      [[9, 10], true]
    ]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "REPLAY_COMPLETED", module: "gov", handoffHeight: 10 }));
  });

  it("retries at the new checkpoint when sync moved on during the handoff", async () => {
    const { runner, commits } = setup({ module: "gov", fromHeight: 1, batchSize: 4, syncCheckpoints: [10, 10, 12], handoffResults: [false, true] });

    await runner.start();

    expect(commits.map(commit => [commit.heights, commit.options.handoff ?? false])).toEqual([
      [[1, 2, 3, 4], false],
      [[5, 6, 7, 8], false],
      [[9, 10], true],
      [[11, 12], true]
    ]);
  });

  it("follows the sync checkpoint when sync starts during a fixed-end replay", async () => {
    const { runner, commits, logger } = setup({
      module: "provider",
      fromHeight: 1,
      toHeight: 4,
      batchSize: 2,
      syncCheckpoints: [undefined, undefined, 6],
      handoffResults: [false, true]
    });

    await runner.start();

    expect(commits.map(commit => [commit.heights, commit.options.handoff ?? false])).toEqual([
      [[1, 2], false],
      [[3, 4], true],
      [[5, 6], true]
    ]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "REPLAY_COMPLETED", module: "provider", handoffHeight: 6 }));
  });

  it("retries a refused handoff without blocks after the poll interval", async () => {
    const { runner, committer } = setup({ module: "bme", fromHeight: 1, marker: 10, syncCheckpoints: [10] });
    committer.handoffWithoutBlocks.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await runner.start();

    expect(committer.handoffWithoutBlocks).toHaveBeenCalledTimes(2);
  });

  it("retries a checkpoint read that fails transiently instead of aborting the replay", async () => {
    const { runner, commits, logger } = setup({ module: "provider", fromHeight: 1, toHeight: 2, batchSize: 2, failCheckpointReadsOnce: true });

    await runner.start();

    expect(commits.map(commit => commit.heights)).toEqual([[1, 2]]);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "REPLAY_CHECKPOINT_READ_RETRY" }));
  });

  it("hands off without blocks when the replay already stands at the sync checkpoint", async () => {
    const { runner, committer, pool } = setup({ module: "bme", fromHeight: 1, marker: 10, syncCheckpoints: [10] });

    await runner.start();

    expect(committer.handoffWithoutBlocks).toHaveBeenCalledWith("replay:bme", 10);
    expect(pool.getBlock).not.toHaveBeenCalled();
  });

  it("seeds genesis for a balance replay when the import is enabled", async () => {
    const { runner, genesisImport, committer } = setup({ module: "balance", fromHeight: 1, toHeight: 2, reset: true, genesisImportEnabled: true });

    await runner.start();

    expect(genesisImport.ensureSeeded).toHaveBeenCalledWith(1);
    expect(genesisImport.ensureSeeded.mock.invocationCallOrder[0]).toBeLessThan(committer.commitBatch.mock.invocationCallOrder[0]);
  });

  it("rejects with RunnerInterruptedError when stopped before the handoff", async () => {
    const { runner, committer } = setup({ module: "gov", fromHeight: 1, toHeight: 10, batchSize: 2 });
    committer.commitBatch.mockImplementationOnce(async () => {
      await runner.dispose();
      return { modulesSkipped: [], handoffCompleted: false };
    });

    await expect(runner.start()).rejects.toThrow(RunnerInterruptedError);
  });

  function renderSql(query: unknown) {
    return new PgDialect().sqlToQuery(query as SQL);
  }

  function setup(input: {
    module: ReplayableModule;
    fromHeight: number;
    toHeight?: number;
    batchSize?: number;
    reset?: boolean;
    marker?: number;
    syncCheckpoints?: (number | undefined)[];
    handoffResults?: boolean[];
    genesisImportEnabled?: boolean;
    failCheckpointReadsOnce?: boolean;
  }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      INDEXER_ROLE: "backfill",
      BACKFILL_MODULE: input.module,
      BACKFILL_FROM_HEIGHT: String(input.fromHeight),
      BACKFILL_TO_HEIGHT: input.toHeight === undefined ? "" : String(input.toHeight),
      BACKFILL_BATCH_SIZE: String(input.batchSize ?? 200),
      BACKFILL_CONCURRENCY: "4",
      BACKFILL_RESET_MODULE: input.reset ? "true" : "false",
      GENESIS_IMPORT: input.genesisImportEnabled ? "true" : "false",
      SYNC_POLL_INTERVAL_MS: "1"
    });

    const executed: unknown[] = [];
    const markerUpserts: Array<{ table: unknown; rows: unknown }> = [];
    const moduleReset = mock<ModuleResetService>();
    moduleReset.reset.mockResolvedValue(undefined);
    const syncCheckpoints = [...(input.syncCheckpoints ?? [])];
    const handoffResults = [...(input.handoffResults ?? [])];
    let markerHeight = input.marker;

    const readSyncCheckpoint = () => (syncCheckpoints.length > 1 ? syncCheckpoints.shift() : syncCheckpoints[0]);
    let checkpointReadsToFail = input.failCheckpointReadsOnce ? 1 : 0;
    const dbFake = {
      select: () => ({
        from: (table: unknown) => ({
          where: (where: unknown) => {
            if (table !== IndexerState) {
              return Promise.resolve([]);
            }
            if (checkpointReadsToFail > 0) {
              checkpointReadsToFail--;
              return Promise.reject(new Error("connection reset"));
            }
            const { params } = renderSql(where);
            if (params.includes(`replay:${input.module}`)) {
              return Promise.resolve(markerHeight === undefined ? [] : [{ stream: `replay:${input.module}`, lastHeight: markerHeight }]);
            }
            const syncCheckpoint = readSyncCheckpoint();
            return Promise.resolve(syncCheckpoint === undefined ? [] : [{ stream: "sync", lastHeight: syncCheckpoint }]);
          }
        })
      }),
      insert: (table: unknown) => ({
        values: (rows: { lastHeight: number }) => ({
          onConflictDoUpdate: () => {
            markerUpserts.push({ table, rows });
            markerHeight = rows.lastHeight;
            return Promise.resolve();
          }
        })
      }),
      execute: (query: unknown) => {
        executed.push(query);
        resetCallsPerLock.push(moduleReset.reset.mock.calls.length);
        return Promise.resolve([]);
      },
      transaction: (callback: (tx: unknown) => Promise<unknown>) => callback(dbFake)
    };
    const resetCallsPerLock: number[] = [];

    const pool = mock<RpcClientPool>();
    pool.getTipHeight.mockResolvedValue(1_000);
    pool.getBlock.mockImplementation(
      async height =>
        ({ block_id: { hash: `h${height}` }, block: { header: { height: String(height), last_block_id: { hash: `h${height - 1}` } } } }) as RpcBlockResult
    );
    pool.getBlockResults.mockResolvedValue({ height: "0", txs_results: null });

    const decoder = mock<BlockDecoderService>();
    decoder.decode.mockImplementation(block => buildDecodedBlock(parseInt(block.block.header.height)));

    const archive = mock<BlockArchiveService>();
    archive.isEnabled.mockReturnValue(false);

    const commits: Array<{ heights: number[]; options: CommitOptions }> = [];
    const committer = mock<BlockCommitterService>();
    committer.commitBatch.mockImplementation(async (blocks, options) => {
      commits.push({ heights: blocks.map(block => block.height), options });
      const handoffCompleted = options.handoff ? handoffResults.shift() ?? true : false;
      return { modulesSkipped: [], handoffCompleted };
    });
    committer.handoffWithoutBlocks.mockResolvedValue(true);

    const genesisImport = mock<GenesisImportService>();
    genesisImport.ensureSeeded.mockResolvedValue(undefined);
    const logger = mock<LoggerService>();

    const runner = new ModuleReplayRunnerService(
      dbFake as unknown as ChainDatabase,
      pool,
      decoder,
      committer,
      archive,
      genesisImport,
      moduleReset,
      config,
      logger
    );

    return { runner, pool, committer, commits, genesisImport, moduleReset, logger, executed, markerUpserts, resetCallsAtFirstLock: () => resetCallsPerLock[0] };
  }

  function buildDecodedBlock(height: number): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.from(`hash-${height}`),
      parentHash: Buffer.from(`hash-${height - 1}`),
      proposerAddress: "PROPOSER",
      transactions: [],
      blockEvents: []
    };
  }
});
