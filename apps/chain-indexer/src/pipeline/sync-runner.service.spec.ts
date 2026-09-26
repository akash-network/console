import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import type { DeferredIndexService } from "@src/db/deferred-index.service";
import { Blocks, IndexerState } from "@src/db/schema";
import type { GenesisImportService } from "@src/genesis/genesis-import.service";
import type { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { SyncLagMetrics } from "@src/pipeline/sync-lag-metrics";
import { SyncRunnerService } from "@src/pipeline/sync-runner.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcBlockResult } from "@src/rpc/rpc-types";
import type { StakingSnapshotService } from "@src/staking/staking-snapshot.service";

describe(SyncRunnerService.name, () => {
  it("stages every synced block in the archive with its raw payloads", async () => {
    const { runner, archive } = setup({ tipHeight: 3 });

    await runner.start();

    expect(archive.putStagedBlockIfAbsent).toHaveBeenCalledTimes(3);
    expect(archive.putStagedBlockIfAbsent).toHaveBeenNthCalledWith(2, {
      height: 2,
      block: expect.objectContaining({ block: expect.objectContaining({ header: expect.objectContaining({ height: "2" }) }) }),
      block_results: expect.objectContaining({ height: "2" })
    });
  });

  it("records the chain tip and every committed block for the lag metrics", async () => {
    const { runner, lag } = setup({ tipHeight: 2 });

    await runner.start();

    expect(lag.recordTip).toHaveBeenCalledWith(2);
    expect(lag.recordCommitted.mock.calls).toEqual([
      [1, new Date("2026-08-12T00:00:00Z")],
      [2, new Date("2026-08-12T00:00:00Z")]
    ]);
  });

  it("records the checkpoint block at startup so a sync that never commits still reports its lag", async () => {
    const { runner, lag } = setup({ tipHeight: 11, checkpointHeight: 10 });

    await runner.start();

    expect(lag.recordCommitted.mock.calls[0]).toEqual([10, new Date("2026-08-11T23:59:54Z")]);
  });

  it("archives a block before committing it", async () => {
    const { runner, archive, committer } = setup({ tipHeight: 1 });

    await runner.start();

    expect(archive.putStagedBlockIfAbsent.mock.invocationCallOrder[0]).toBeLessThan(committer.commit.mock.invocationCallOrder[0]);
  });

  it("logs the archive state once at startup", async () => {
    const { runner, archive } = setup({ tipHeight: 1 });

    await runner.start();

    expect(archive.logState).toHaveBeenCalledTimes(1);
  });

  it("restores indexes a backfill left deferred before committing any block", async () => {
    const { runner, committer, deferredIndexes } = setup({ tipHeight: 1 });
    deferredIndexes.restore.mockResolvedValue(["transactions_hash_idx"]);

    await runner.start();

    expect(deferredIndexes.restore.mock.invocationCallOrder[0]).toBeLessThan(committer.commit.mock.invocationCallOrder[0]);
  });

  it("rejects after exhausting retries when the archive stays unavailable and never commits", async () => {
    vi.useFakeTimers();

    try {
      const { runner, committer } = setup({ tipHeight: 1, archiveFailure: new Error("gcs down") });

      const started = runner.start();
      started.catch(() => undefined);
      await vi.runAllTimersAsync();

      await expect(started).rejects.toThrow("gcs down");
      expect(committer.commit).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  describe("when the archive is disabled", () => {
    it("syncs without touching the archive and logs the disabled state", async () => {
      const { runner, archive, committer } = setup({ tipHeight: 2, archiveEnabled: false });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(2);
      expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
      expect(archive.logState).toHaveBeenCalledTimes(1);
    });
  });

  it("starts from the chain tip when no checkpoint or start height is configured", async () => {
    const { runner, committer } = setup({ tipHeight: 4, omitStartHeight: true });

    await runner.start();

    expect(committer.commit).toHaveBeenCalledTimes(1);
    expect(committer.commit).toHaveBeenCalledWith(expect.objectContaining({ height: 4 }));
  });

  describe("genesis import", () => {
    it("runs the genesis import at the fresh start height when enabled", async () => {
      const { runner, genesisImport } = setup({ tipHeight: 1, genesisImportEnabled: true });

      await runner.start();

      expect(genesisImport.ensureSeeded).toHaveBeenCalledWith(1);
    });

    it("does not run the genesis import when disabled", async () => {
      const { runner, genesisImport } = setup({ tipHeight: 1 });

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
    });

    it("does not run the genesis import when resuming from a checkpoint", async () => {
      const { runner, genesisImport } = setup({ tipHeight: 2, genesisImportEnabled: true, checkpointHeight: 1 });

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
    });

    it("halts before syncing when the genesis guard rejects a mid-chain start", async () => {
      const { runner, genesisImport, committer } = setup({ tipHeight: 1, genesisImportEnabled: true });
      genesisImport.ensureSeeded.mockRejectedValue(new Error("mid-chain"));

      await expect(runner.start()).rejects.toThrow("mid-chain");
      expect(committer.commit).not.toHaveBeenCalled();
    });

    it("warns when genesis import is enabled on resume but genesis was never seeded", async () => {
      const { runner, genesisImport, logger } = setup({ tipHeight: 2, genesisImportEnabled: true, checkpointHeight: 1 });
      genesisImport.hasSeeded.mockResolvedValue(false);

      await runner.start();

      expect(genesisImport.ensureSeeded).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "GENESIS_IMPORT_SKIPPED_RESUMED_WITHOUT_MARKER" }));
    });

    it("does not warn when resuming an indexer that already seeded genesis", async () => {
      const { runner, genesisImport, logger } = setup({ tipHeight: 2, genesisImportEnabled: true, checkpointHeight: 1 });
      genesisImport.hasSeeded.mockResolvedValue(true);

      await runner.start();

      expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "GENESIS_IMPORT_SKIPPED_RESUMED_WITHOUT_MARKER" }));
    });
  });

  describe("fresh start above a backfilled range", () => {
    it("verifies the first block against the block a backfill left just below the start height", async () => {
      const { runner, committer } = setup({ tipHeight: 1_000, startHeight: 1_000, previousBlockHash: Buffer.from("hash-999"), brokenParentAtHeight: 1_000 });

      await expect(runner.start()).rejects.toThrow("Parent hash mismatch at height 1000; halting sync");
      expect(committer.commit).not.toHaveBeenCalled();
    });

    it("commits the first block when it chains onto the backfilled block below it", async () => {
      const { runner, committer } = setup({ tipHeight: 1_000, startHeight: 1_000, previousBlockHash: Buffer.from("hash-999") });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe("staking snapshot", () => {
    it("snapshots at the observed tip after catching up, not only once ahead of the tip", async () => {
      const { runner, stakingSnapshot, committer } = setup({ tipHeight: 3, stopOn: "snapshot" });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(3);
      expect(stakingSnapshot.snapshot).toHaveBeenCalledTimes(1);
      expect(stakingSnapshot.snapshot).toHaveBeenCalledWith(3, expect.any(Function));
    });

    it("chases a moving tip without waiting out the poll interval", async () => {
      const { runner, pool, committer } = setup({ tipHeight: 1, pollIntervalMs: 60_000 });
      let tipCalls = 0;
      pool.getTipHeight.mockImplementation(async () => {
        tipCalls += 1;
        return tipCalls === 1 ? 1 : 2;
      });
      committer.commit.mockImplementation(async decoded => {
        if (decoded.height >= 2) {
          await runner.dispose();
        }
      });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(2);
    });

    it("keeps syncing when a staking snapshot fails", async () => {
      const { runner, stakingSnapshot, committer, pool } = setup({ tipHeight: 1, pollIntervalMs: 1 });
      stakingSnapshot.snapshot.mockRejectedValueOnce(new Error("abci down"));
      let tipCalls = 0;
      pool.getTipHeight.mockImplementation(async () => {
        tipCalls += 1;
        return tipCalls === 1 ? 1 : 2;
      });
      committer.commit.mockImplementation(async decoded => {
        if (decoded.height >= 2) {
          await runner.dispose();
        }
      });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(2);
      expect(stakingSnapshot.snapshot).toHaveBeenCalled();
    });
  });

  function setup(input: {
    tipHeight: number;
    archiveEnabled?: boolean;
    archiveFailure?: Error;
    genesisImportEnabled?: boolean;
    checkpointHeight?: number;
    omitStartHeight?: boolean;
    startHeight?: number;
    previousBlockHash?: Buffer;
    brokenParentAtHeight?: number;
    stopOn?: "commit" | "snapshot";
    pollIntervalMs?: number;
  }) {
    const archiveEnabled = input.archiveEnabled ?? true;
    const stopOn = input.stopOn ?? "commit";
    const startHeight = input.startHeight ?? 1;
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      ...(input.omitStartHeight ? {} : { SYNC_START_HEIGHT: String(startHeight) }),
      ARCHIVE_BUCKET: archiveEnabled ? "raw-blocks" : "",
      ...(input.genesisImportEnabled ? { GENESIS_IMPORT: "true" } : {}),
      ...(input.pollIntervalMs !== undefined ? { SYNC_POLL_INTERVAL_MS: String(input.pollIntervalMs) } : {})
    });

    const dbFake = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === IndexerState && input.checkpointHeight != null) {
              return Promise.resolve([{ stream: "sync", lastHeight: input.checkpointHeight }]);
            }
            if (table === Blocks && input.checkpointHeight != null) {
              return Promise.resolve([
                { height: input.checkpointHeight, hash: Buffer.from(`hash-${input.checkpointHeight}`), datetime: new Date("2026-08-11T23:59:54Z") }
              ]);
            }
            if (table === Blocks && input.previousBlockHash) {
              return Promise.resolve([{ height: startHeight - 1, hash: input.previousBlockHash, datetime: new Date("2026-08-11T23:59:54Z") }]);
            }
            return Promise.resolve([]);
          }
        })
      })
    };

    const pool = mock<RpcClientPool>();
    pool.getTipHeight.mockResolvedValue(input.tipHeight);
    pool.getBlock.mockImplementation(async height => ({ block: { header: { height: String(height) } } }) as RpcBlockResult);
    pool.getBlockResults.mockImplementation(async height => ({ height: String(height), txs_results: null }));

    const decoder = mock<BlockDecoderService>();
    decoder.decode.mockImplementation(block => {
      const height = parseInt(block.block.header.height);
      return buildDecodedBlock(height, input.brokenParentAtHeight === height);
    });

    const archive = mock<BlockArchiveService>();
    archive.isEnabled.mockReturnValue(archiveEnabled);
    if (input.archiveFailure) {
      archive.putStagedBlockIfAbsent.mockRejectedValue(input.archiveFailure);
    } else {
      archive.putStagedBlockIfAbsent.mockResolvedValue(undefined);
    }

    const committer = mock<BlockCommitterService>();
    const genesisImport = mock<GenesisImportService>();
    const stakingSnapshot = mock<StakingSnapshotService>();
    const deferredIndexes = mock<DeferredIndexService>();
    deferredIndexes.restore.mockResolvedValue([]);
    const logger = mock<LoggerService>();
    const lag = mock<SyncLagMetrics>();
    const runner = new SyncRunnerService(
      dbFake as unknown as ChainDatabase,
      pool,
      decoder,
      committer,
      archive,
      genesisImport,
      stakingSnapshot,
      deferredIndexes,
      lag,
      config,
      logger
    );
    if (stopOn === "commit") {
      committer.commit.mockImplementation(async decoded => {
        if (decoded.height >= input.tipHeight) {
          await runner.dispose();
        }
      });
    }
    if (stopOn === "snapshot") {
      stakingSnapshot.snapshot.mockImplementation(async () => {
        await runner.dispose();
      });
    }

    return { runner, archive, committer, genesisImport, stakingSnapshot, deferredIndexes, logger, pool, lag };
  }

  function buildDecodedBlock(height: number, brokenParent = false): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-12T00:00:00Z"),
      hash: Buffer.from(`hash-${height}`),
      parentHash: brokenParent ? Buffer.from("bogus") : height > 1 ? Buffer.from(`hash-${height - 1}`) : null,
      proposerAddress: "PROPOSER",
      transactions: []
    };
  }
});
