import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import { Blocks, IndexerState } from "@src/db/schema";
import type { GenesisImportService } from "@src/genesis/genesis-import.service";
import type { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
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

  describe("staking snapshot", () => {
    it("snapshots at the observed tip after catching up, not only once ahead of the tip", async () => {
      const { runner, stakingSnapshot, committer } = setup({ tipHeight: 3, stopOn: "snapshot" });

      await runner.start();

      expect(committer.commit).toHaveBeenCalledTimes(3);
      expect(stakingSnapshot.snapshot).toHaveBeenCalledTimes(1);
      expect(stakingSnapshot.snapshot).toHaveBeenCalledWith(3);
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
    stopOn?: "commit" | "snapshot";
    pollIntervalMs?: number;
  }) {
    const archiveEnabled = input.archiveEnabled ?? true;
    const stopOn = input.stopOn ?? "commit";
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      ...(input.omitStartHeight ? {} : { SYNC_START_HEIGHT: "1" }),
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
              return Promise.resolve([{ height: input.checkpointHeight, hash: Buffer.from(`hash-${input.checkpointHeight}`) }]);
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
    decoder.decode.mockImplementation(block => buildDecodedBlock(parseInt(block.block.header.height)));

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
    const logger = mock<LoggerService>();
    const runner = new SyncRunnerService(dbFake as unknown as ChainDatabase, pool, decoder, committer, archive, genesisImport, stakingSnapshot, config, logger);
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

    return { runner, archive, committer, genesisImport, stakingSnapshot, logger, pool };
  }

  function buildDecodedBlock(height: number): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-12T00:00:00Z"),
      hash: Buffer.from(`hash-${height}`),
      parentHash: height > 1 ? Buffer.from(`hash-${height - 1}`) : null,
      proposerAddress: "PROPOSER",
      transactions: []
    };
  }
});
