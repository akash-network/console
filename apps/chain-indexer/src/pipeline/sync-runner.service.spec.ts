import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import type { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import { SyncRunnerService } from "@src/pipeline/sync-runner.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcBlockResult } from "@src/rpc/rpc-types";

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

  function setup(input: { tipHeight: number; archiveEnabled?: boolean; archiveFailure?: Error }) {
    const archiveEnabled = input.archiveEnabled ?? true;
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      SYNC_START_HEIGHT: "1",
      ARCHIVE_BUCKET: archiveEnabled ? "raw-blocks" : ""
    });

    const dbFake = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([])
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
    const logger = mock<LoggerService>();
    const runner = new SyncRunnerService(dbFake as unknown as ChainDatabase, pool, decoder, committer, archive, config, logger);
    committer.commit.mockImplementation(async decoded => {
      if (decoded.height >= input.tipHeight) {
        await runner.dispose();
      }
    });

    return { runner, archive, committer, logger, pool };
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
