import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RawBlockRecord } from "@src/archive/archive-layout";
import type { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import type { DeferredIndexService } from "@src/db/deferred-index.service";
import { Blocks, IndexerState } from "@src/db/schema";
import type { GenesisImportService } from "@src/genesis/genesis-import.service";
import { GenesisMidChainError } from "@src/genesis/genesis-mid-chain-error";
import { BackfillRunnerService } from "@src/pipeline/backfill-runner.service";
import type { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { RunnerInterruptedError } from "@src/pipeline/runner-interrupted-error";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcBlockResult } from "@src/rpc/rpc-types";

describe(BackfillRunnerService.name, () => {
  it("commits blocks in ascending order even when fetches resolve out of order", async () => {
    const { runner, committer } = setup({
      fromHeight: 1,
      toHeight: 5,
      batchSize: 5,
      concurrency: 5,
      fetchDelayMs: height => (6 - height) * 5
    });

    await runner.start();

    expect(committer.commitBatch).toHaveBeenCalledTimes(1);
    expect(committedHeights(committer)).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("never fetches more blocks in parallel than the configured concurrency", async () => {
    const { runner, maxObservedConcurrency } = setup({ fromHeight: 1, toHeight: 10, batchSize: 10, concurrency: 3, fetchDelayMs: () => 2 });

    await runner.start();

    expect(maxObservedConcurrency()).toBeLessThanOrEqual(3);
  });

  it("commits in batches of the configured size under the range-scoped stream", async () => {
    const { runner, committer } = setup({ fromHeight: 1, toHeight: 5, batchSize: 2 });

    await runner.start();

    expect(committedHeights(committer)).toEqual([[1, 2], [3, 4], [5]]);
    expect(committer.commitBatch.mock.calls.map(call => call[1])).toEqual([{ stream: "backfill:1-5" }, { stream: "backfill:1-5" }, { stream: "backfill:1-5" }]);
  });

  it("resumes after the checkpoint and verifies continuity against the checkpoint block", async () => {
    const { runner, committer, pool } = setup({
      fromHeight: 1,
      toHeight: 5,
      checkpointHeight: 3,
      seedBlock: { height: 3, hash: heightHash(3) }
    });

    await runner.start();

    expect(pool.getBlock).not.toHaveBeenCalledWith(3);
    expect(committedHeights(committer)).toEqual([[4, 5]]);
  });

  it("throws when the checkpoint block is missing on resume", async () => {
    const { runner, committer } = setup({ fromHeight: 1, toHeight: 5, checkpointHeight: 3 });

    await expect(runner.start()).rejects.toThrow("Checkpoint block 3 is missing");
    expect(committer.commitBatch).not.toHaveBeenCalled();
  });

  it("exits without fetching anything when the checkpoint already covers the range", async () => {
    const { runner, committer, pool, logger } = setup({ fromHeight: 1, toHeight: 5, checkpointHeight: 5 });

    await runner.start();

    expect(pool.getBlock).not.toHaveBeenCalled();
    expect(committer.commitBatch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_ALREADY_COMPLETE" }));
  });

  it("fails when the range ends above the chain tip", async () => {
    const { runner, committer } = setup({ fromHeight: 1, toHeight: 5, tipHeight: 3 });

    await expect(runner.start()).rejects.toThrow("BACKFILL_TO_HEIGHT 5 is above the chain tip 3");
    expect(committer.commitBatch).not.toHaveBeenCalled();
  });

  it("halts without committing when the parent-hash chain breaks", async () => {
    const { runner, committer } = setup({ fromHeight: 1, toHeight: 5, brokenParentAtHeight: 3 });

    await expect(runner.start()).rejects.toThrow("Parent hash mismatch at height 3; halting backfill");
    expect(committer.commitBatch).not.toHaveBeenCalled();
  });

  it("retries a failed fetch and still commits the block", async () => {
    vi.useFakeTimers();

    try {
      const { runner, committer, logger } = setup({ fromHeight: 1, toHeight: 2, failFetchOnceAtHeight: 2 });

      const started = runner.start();
      await vi.runAllTimersAsync();
      await started;

      expect(committedHeights(committer)).toEqual([[1, 2]]);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_FETCH_RETRY", height: 2, attempt: 1 }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs a completion summary with throughput counters", async () => {
    const { runner, logger } = setup({ fromHeight: 1, toHeight: 5, txCountPerBlock: 2 });

    await runner.start();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "BACKFILL_COMPLETED",
        stream: "backfill:1-5",
        startHeight: 1,
        endHeight: 5,
        blocksCommitted: 5,
        transactionsCommitted: 10,
        durationMs: expect.any(Number),
        blocksPerSecond: expect.any(Number)
      })
    );
  });

  it("rejects with RunnerInterruptedError when stopped before the range completes", async () => {
    const { runner, committer } = setup({ fromHeight: 1, toHeight: 10, batchSize: 2, concurrency: 2 });
    committer.commitBatch.mockImplementationOnce(async () => {
      await runner.dispose();
    });

    await expect(runner.start()).rejects.toThrow(RunnerInterruptedError);
    expect(committedHeights(committer)).toEqual([[1, 2]]);
  });

  it("reports completion when stopped during the final commit that covers the range", async () => {
    const { runner, committer, logger } = setup({ fromHeight: 1, toHeight: 5, batchSize: 5, concurrency: 5 });
    committer.commitBatch.mockImplementationOnce(async () => {
      await runner.dispose();
    });

    await expect(runner.start()).resolves.toBeUndefined();
    expect(committedHeights(committer)).toEqual([[1, 2, 3, 4, 5]]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_COMPLETED" }));
  });

  it("assembles the next batch while the previous batch is still committing", async () => {
    const { runner, committer, pool } = setup({ fromHeight: 1, toHeight: 8, batchSize: 4, concurrency: 2 });
    let releaseFirstCommit!: () => void;
    committer.commitBatch.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseFirstCommit = resolve;
        })
    );

    const started = runner.start();
    await vi.waitFor(() => expect(pool.getBlock).toHaveBeenCalledWith(8));

    expect(committer.commitBatch).toHaveBeenCalledTimes(1);
    releaseFirstCommit();
    await started;
    expect(committedHeights(committer)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8]
    ]);
  });

  it("fails the run without committing later batches when a detached commit keeps failing", async () => {
    vi.useFakeTimers();

    try {
      const { runner, committer, logger } = setup({ fromHeight: 1, toHeight: 12, batchSize: 4, concurrency: 2 });
      committer.commitBatch.mockImplementation(async blocks => {
        if (blocks[0].height === 1) {
          throw new Error("db down");
        }
      });

      const started = runner.start();
      started.catch(() => undefined);
      await vi.runAllTimersAsync();

      await expect(started).rejects.toThrow("db down");
      expect(committedHeights(committer).filter(heights => heights[0] !== 1)).toEqual([]);
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_COMPLETED" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the failed commit as the cause when the chain breaks while that commit is still rejecting", async () => {
    vi.useFakeTimers();

    try {
      const { runner, committer, logger } = setup({ fromHeight: 1, toHeight: 6, batchSize: 2, concurrency: 1, brokenParentAtHeight: 3 });
      committer.commitBatch.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error("disk full");
      });

      const started = runner.start();
      started.catch(() => undefined);
      await vi.runAllTimersAsync();

      await expect(started).rejects.toThrow("disk full");
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_COMMIT_FAILED", error: expect.any(Error) }));
    } finally {
      vi.useRealTimers();
    }
  });

  describe("when BACKFILL_DEFER_INDEXES is on", () => {
    it("drops the deferrable indexes before the first commit and leaves them deferred at the end", async () => {
      const { runner, committer, deferredIndexes } = setup({ fromHeight: 1, toHeight: 2, deferIndexes: true });
      deferredIndexes.defer.mockResolvedValue(["transactions_hash_idx"]);

      await runner.start();

      expect(deferredIndexes.defer.mock.invocationCallOrder[0]).toBeLessThan(committer.commitBatch.mock.invocationCallOrder[0]);
      expect(deferredIndexes.restore).not.toHaveBeenCalled();
    });

    it("leaves the indexes in place when the range is already complete", async () => {
      const { runner, deferredIndexes } = setup({ fromHeight: 1, toHeight: 5, checkpointHeight: 5, deferIndexes: true });

      await runner.start();

      expect(deferredIndexes.defer).not.toHaveBeenCalled();
    });

    it("leaves the indexes in place when the range is invalid", async () => {
      const { runner, deferredIndexes } = setup({ fromHeight: 1, toHeight: 5, tipHeight: 3, deferIndexes: true });

      await expect(runner.start()).rejects.toThrow();

      expect(deferredIndexes.defer).not.toHaveBeenCalled();
    });
  });

  describe("when BACKFILL_DEFER_INDEXES is off", () => {
    it("restores previously deferred indexes before the first commit", async () => {
      const { runner, committer, deferredIndexes } = setup({ fromHeight: 1, toHeight: 2 });
      deferredIndexes.restore.mockResolvedValue(["transactions_hash_idx"]);

      await runner.start();

      expect(deferredIndexes.restore.mock.invocationCallOrder[0]).toBeLessThan(committer.commitBatch.mock.invocationCallOrder[0]);
      expect(deferredIndexes.defer).not.toHaveBeenCalled();
    });

    it("restores deferred indexes even when the range is already complete", async () => {
      const { runner, deferredIndexes } = setup({ fromHeight: 1, toHeight: 5, checkpointHeight: 5 });

      await runner.start();

      expect(deferredIndexes.restore).toHaveBeenCalledTimes(1);
    });
  });

  describe("genesis import", () => {
    it("seeds genesis at the range start before the first commit when enabled on a fresh run", async () => {
      const { runner, committer, genesisImport } = setup({ fromHeight: 1, toHeight: 3, genesisImportEnabled: true });

      await runner.start();

      expect(genesisImport.ensureSeeded).toHaveBeenCalledWith(1);
      expect(genesisImport.ensureSeeded.mock.invocationCallOrder[0]).toBeLessThan(committer.commitBatch.mock.invocationCallOrder[0]);
    });

    it("does not seed genesis when resuming from a checkpoint", async () => {
      const { runner, genesisImport } = setup({
        fromHeight: 1,
        toHeight: 5,
        checkpointHeight: 3,
        seedBlock: { height: 3, hash: heightHash(3) },
        genesisImportEnabled: true
      });

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
    });

    it("does not seed genesis for an archive-only run", async () => {
      const { runner, genesisImport } = setup({ fromHeight: 1, toHeight: 2, archiveEnabled: true, archiveOnly: true, genesisImportEnabled: true });

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
    });

    it("does not seed genesis when the import is disabled", async () => {
      const { runner, genesisImport } = setup({ fromHeight: 1, toHeight: 2 });

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
    });

    it("halts before fetching when the genesis guard rejects the range start", async () => {
      const { runner, pool, committer, genesisImport } = setup({ fromHeight: 500, toHeight: 502, genesisImportEnabled: true });
      genesisImport.ensureSeeded.mockRejectedValue(new GenesisMidChainError("mid-chain"));

      await expect(runner.start()).rejects.toBeInstanceOf(GenesisMidChainError);
      expect(pool.getBlock).not.toHaveBeenCalled();
      expect(committer.commitBatch).not.toHaveBeenCalled();
    });
  });

  describe("when BACKFILL_ARCHIVE_ONLY is on", () => {
    it("archives the range from rpc without decoding or committing", async () => {
      const { runner, committer, decoder, archive } = setup({ fromHeight: 1_000, toHeight: 1_999, tipHeight: 10_000, archiveEnabled: true, archiveOnly: true });

      await runner.start();

      expect(archive.putChunkIfAbsent).toHaveBeenCalledTimes(1);
      expect(decoder.decode).not.toHaveBeenCalled();
      expect(committer.commitBatch).not.toHaveBeenCalled();
    });

    it("checkpoints progress under the archive stream and reports completion", async () => {
      const { runner, checkpointUpserts, logger } = setup({ fromHeight: 1_000, toHeight: 1_999, tipHeight: 10_000, archiveEnabled: true, archiveOnly: true });

      await runner.start();

      expect(checkpointUpserts.at(-1)).toEqual({ table: IndexerState, rows: expect.objectContaining({ stream: "archive:1000-1999", lastHeight: 1_999 }) });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "ARCHIVE_BUILD_COMPLETED", stream: "archive:1000-1999", blocksArchived: 1_000 })
      );
    });

    it("resumes from the archive checkpoint without refetching archived heights", async () => {
      const { runner, pool } = setup({
        fromHeight: 1_000,
        toHeight: 1_999,
        tipHeight: 10_000,
        archiveEnabled: true,
        archiveOnly: true,
        checkpointHeight: 1_499
      });

      await runner.start();

      expect(pool.getBlock).not.toHaveBeenCalledWith(1_000);
      expect(pool.getBlock).toHaveBeenCalledWith(1_500);
    });

    it("halts before checkpointing when the raw parent-hash chain breaks", async () => {
      const { runner, checkpointUpserts } = setup({ fromHeight: 1, toHeight: 5, archiveEnabled: true, archiveOnly: true, brokenParentAtHeight: 3 });

      await expect(runner.start()).rejects.toThrow("Parent hash mismatch at height 3; halting backfill");
      expect(checkpointUpserts).toEqual([]);
    });

    it("neither defers nor restores indexes", async () => {
      const { runner, deferredIndexes } = setup({ fromHeight: 1, toHeight: 2, archiveEnabled: true, archiveOnly: true, deferIndexes: true });

      await runner.start();

      expect(deferredIndexes.defer).not.toHaveBeenCalled();
      expect(deferredIndexes.restore).not.toHaveBeenCalled();
    });
  });

  describe("when the archive is enabled", () => {
    it("serves an archived range without rpc fetches or archive writes", async () => {
      const { runner, committer, pool, archive } = setup({ fromHeight: 1_000, toHeight: 1_999, tipHeight: 10_000, archiveEnabled: true });
      archive.getChunk.mockResolvedValue(buildRawRecords(1_000, 1_999));

      await runner.start();

      expect(committedHeights(committer).flat()).toHaveLength(1_000);
      expect(pool.getBlock).not.toHaveBeenCalled();
      expect(pool.getBlockResults).not.toHaveBeenCalled();
      expect(archive.putChunkIfAbsent).not.toHaveBeenCalled();
      expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
    });

    it("compacts an rpc-fed aligned range into a single chunk", async () => {
      const { runner, committer, archive } = setup({ fromHeight: 1_000, toHeight: 1_999, tipHeight: 10_000, archiveEnabled: true });

      await runner.start();

      expect(committedHeights(committer).flat()).toHaveLength(1_000);
      expect(archive.putChunkIfAbsent).toHaveBeenCalledTimes(1);
      expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
    });

    it("stages singles for a range that cannot complete a chunk", async () => {
      const { runner, archive } = setup({ fromHeight: 1_000, toHeight: 1_499, tipHeight: 10_000, archiveEnabled: true });

      await runner.start();

      expect(archive.putStagedBlockIfAbsent).toHaveBeenCalledTimes(500);
      expect(archive.putChunkIfAbsent).not.toHaveBeenCalled();
    });

    it("fails the job without completing when the chunk flush keeps failing", async () => {
      vi.useFakeTimers();

      try {
        const { runner, archive, logger } = setup({ fromHeight: 1_000, toHeight: 1_999, tipHeight: 10_000, archiveEnabled: true });
        archive.putChunkIfAbsent.mockRejectedValue(new Error("gcs down"));

        const started = runner.start();
        started.catch(() => undefined);
        await vi.runAllTimersAsync();

        await expect(started).rejects.toThrow("gcs down");
        expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "BACKFILL_COMPLETED" }));
      } finally {
        vi.useRealTimers();
      }
    });
  });

  function setup(input: {
    fromHeight: number;
    toHeight: number;
    batchSize?: number;
    concurrency?: number;
    tipHeight?: number;
    checkpointHeight?: number;
    seedBlock?: { height: number; hash: Buffer };
    fetchDelayMs?: (height: number) => number;
    failFetchOnceAtHeight?: number;
    brokenParentAtHeight?: number;
    txCountPerBlock?: number;
    archiveEnabled?: boolean;
    archiveOnly?: boolean;
    deferIndexes?: boolean;
    genesisImportEnabled?: boolean;
  }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      INDEXER_ROLE: "backfill",
      BACKFILL_FROM_HEIGHT: String(input.fromHeight),
      BACKFILL_TO_HEIGHT: String(input.toHeight),
      BACKFILL_BATCH_SIZE: String(input.batchSize ?? 200),
      BACKFILL_CONCURRENCY: String(input.concurrency ?? 10),
      BACKFILL_DEFER_INDEXES: input.deferIndexes ? "true" : "false",
      BACKFILL_ARCHIVE_ONLY: input.archiveOnly ? "true" : "false",
      GENESIS_IMPORT: input.genesisImportEnabled ? "true" : "false",
      ARCHIVE_BUCKET: input.archiveEnabled ? "raw-blocks" : ""
    });

    const checkpointUpserts: Array<{ table: unknown; rows: unknown }> = [];
    const dbFake = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === IndexerState && input.checkpointHeight !== undefined) {
              return Promise.resolve([{ stream: `backfill:${input.fromHeight}-${input.toHeight}`, lastHeight: input.checkpointHeight }]);
            }
            if (table === Blocks && input.seedBlock) {
              return Promise.resolve([input.seedBlock]);
            }
            return Promise.resolve([]);
          }
        })
      }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => ({
          onConflictDoUpdate: () => {
            checkpointUpserts.push({ table, rows });
            return Promise.resolve();
          }
        })
      })
    };

    let activeFetches = 0;
    let maxActiveFetches = 0;
    let failedOnce = false;
    const pool = mock<RpcClientPool>();
    pool.getTipHeight.mockResolvedValue(input.tipHeight ?? 1_000);
    pool.getBlock.mockImplementation(async height => {
      if (input.failFetchOnceAtHeight === height && !failedOnce) {
        failedOnce = true;
        throw new AggregateError([new Error("all nodes failed")], `Failed to fetch block ${height}`);
      }

      activeFetches++;
      maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
      const fetchDelayMs = input.fetchDelayMs?.(height) ?? 0;
      if (fetchDelayMs > 0) {
        await delay(fetchDelayMs);
      }
      activeFetches--;
      const parentHash = input.brokenParentAtHeight === height ? "deadbeef" : heightHash(height - 1).toString("hex");
      return {
        block_id: { hash: heightHash(height).toString("hex") },
        block: { header: { height: String(height), last_block_id: { hash: parentHash } } }
      } as RpcBlockResult;
    });
    pool.getBlockResults.mockResolvedValue({ height: "0", txs_results: null });

    const decoder = mock<BlockDecoderService>();
    decoder.decode.mockImplementation(block => {
      const height = parseInt(block.block.header.height);
      return buildDecodedBlock(height, {
        parentHash: input.brokenParentAtHeight === height ? Buffer.from("bogus") : heightHash(height - 1),
        txCount: input.txCountPerBlock ?? 0
      });
    });

    const committer = mock<BlockCommitterService>();
    committer.commitBatch.mockResolvedValue(undefined);

    const archive = mock<BlockArchiveService>();
    archive.isEnabled.mockReturnValue(input.archiveEnabled ?? false);
    archive.getChunk.mockResolvedValue(null);
    archive.getStagedBlock.mockResolvedValue(null);
    archive.putChunkIfAbsent.mockResolvedValue(undefined);
    archive.putStagedBlockIfAbsent.mockResolvedValue(undefined);
    archive.deleteStagedBlocks.mockResolvedValue(undefined);

    const logger = mock<LoggerService>();
    const deferredIndexes = mock<DeferredIndexService>();
    deferredIndexes.defer.mockResolvedValue([]);
    deferredIndexes.restore.mockResolvedValue([]);
    const genesisImport = mock<GenesisImportService>();
    genesisImport.ensureSeeded.mockResolvedValue(undefined);

    const runner = new BackfillRunnerService(
      dbFake as unknown as ChainDatabase,
      pool,
      decoder,
      committer,
      archive,
      deferredIndexes,
      genesisImport,
      config,
      logger
    );

    return {
      runner,
      committer,
      decoder,
      pool,
      archive,
      deferredIndexes,
      genesisImport,
      logger,
      checkpointUpserts,
      maxObservedConcurrency: () => maxActiveFetches
    };
  }

  function committedHeights(committer: { commitBatch: { mock: { calls: unknown[][] } } }) {
    return committer.commitBatch.mock.calls.map(call => (call[0] as DecodedBlock[]).map(block => block.height));
  }

  function buildDecodedBlock(height: number, options: { parentHash: Buffer; txCount: number }): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: heightHash(height),
      parentHash: options.parentHash,
      proposerAddress: "PROPOSER",
      transactions: Array.from({ length: options.txCount }, (_, index) => ({
        index,
        hash: Buffer.from(`tx-${height}-${index}`),
        code: 0,
        gasUsed: 0,
        gasWanted: 0,
        fee: [],
        messages: []
      }))
    };
  }

  function heightHash(height: number): Buffer {
    return Buffer.from(`hash-${height}`);
  }

  function buildRawRecords(fromHeight: number, toHeight: number): RawBlockRecord[] {
    return Array.from({ length: toHeight - fromHeight + 1 }, (_, index) => {
      const height = fromHeight + index;
      return {
        height,
        block: { block: { header: { height: String(height) } } } as RpcBlockResult,
        block_results: { height: String(height), txs_results: null }
      };
    });
  }
});
