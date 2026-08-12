import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { ArchiveBlockSource } from "@src/archive/archive-block-source";
import type { ChunkRange, RawBlockRecord } from "@src/archive/archive-layout";
import type { BlockArchiveService } from "@src/archive/block-archive.service";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

describe(ArchiveBlockSource.name, () => {
  it("serves an archived chunk to concurrent callers with a single fetch and zero rpc calls", async () => {
    const { source, archive, pool } = setup({ startHeight: 2_000, endHeight: 2_999 });
    archive.getChunk.mockResolvedValue(buildChunkRecords({ start: 2_000, end: 2_999 }));

    const records = await Promise.all(Array.from({ length: 50 }, (_, index) => source.getRecord(2_000 + index)));

    expect(records.map(record => record.height)).toEqual(Array.from({ length: 50 }, (_, index) => 2_000 + index));
    expect(archive.getChunk).toHaveBeenCalledTimes(1);
    expect(pool.getBlock).not.toHaveBeenCalled();
    expect(archive.putChunkIfAbsent).not.toHaveBeenCalled();
    expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
  });

  it("prefers a staged block over rpc when the chunk misses", async () => {
    const { source, archive, pool } = setup({ startHeight: 2_000, endHeight: 2_099 });
    archive.getStagedBlock.mockImplementation(async height => (height === 2_000 ? buildRecord(2_000) : null));

    const staged = await source.getRecord(2_000);
    const fetched = await source.getRecord(2_001);

    expect(staged).toEqual(buildRecord(2_000));
    expect(fetched.height).toBe(2_001);
    expect(pool.getBlock).toHaveBeenCalledTimes(1);
    expect(pool.getBlock).toHaveBeenCalledWith(2_001);
  });

  it("stages rpc-fetched blocks immediately in a range that cannot complete a chunk", async () => {
    const { source, archive } = setup({ startHeight: 2_000, endHeight: 2_499 });

    for (let height = 2_000; height <= 2_499; height++) {
      await source.getRecord(height);
    }

    expect(archive.putStagedBlockIfAbsent).toHaveBeenCalledTimes(500);
    expect(archive.putChunkIfAbsent).not.toHaveBeenCalled();
  });

  it("compacts a completed chunk range and deletes only the staged blocks it consumed", async () => {
    const { source, archive, logger } = setup({ startHeight: 2_000, endHeight: 2_999 });
    archive.getStagedBlock.mockImplementation(async height => (height <= 2_001 ? buildRecord(height) : null));

    for (let height = 2_000; height <= 2_999; height++) {
      await source.getRecord(height);
    }

    expect(archive.putChunkIfAbsent).toHaveBeenCalledTimes(1);
    const [range, records] = archive.putChunkIfAbsent.mock.calls[0];
    expect(range).toEqual({ start: 2_000, end: 2_999 });
    expect(records).toHaveLength(1_000);
    expect(records[0].height).toBe(2_000);
    expect(records[999].height).toBe(2_999);
    expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
    expect(archive.deleteStagedBlocks).toHaveBeenCalledWith([2_000, 2_001]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ARCHIVE_RANGE_COMPACTED" }));
  });

  it("re-attempts the chunk put when a retried call follows a failed flush", async () => {
    const { source, archive } = setup({ startHeight: 2_000, endHeight: 2_999 });
    archive.putChunkIfAbsent.mockRejectedValueOnce(new Error("gcs down"));

    for (let height = 2_000; height <= 2_998; height++) {
      await source.getRecord(height);
    }
    await expect(source.getRecord(2_999)).rejects.toThrow("gcs down");
    await expect(source.getRecord(2_999)).resolves.toEqual(expect.objectContaining({ height: 2_999 }));

    expect(archive.putChunkIfAbsent).toHaveBeenCalledTimes(2);
  });

  it("re-issues the chunk fetch when a retried call follows a rejected fetch", async () => {
    const { source, archive } = setup({ startHeight: 2_000, endHeight: 2_999 });
    archive.getChunk.mockRejectedValueOnce(new Error("gcs down"));

    await expect(source.getRecord(2_000)).rejects.toThrow("gcs down");
    await expect(source.getRecord(2_000)).resolves.toEqual(expect.objectContaining({ height: 2_000 }));

    expect(archive.getChunk).toHaveBeenCalledTimes(2);
  });

  it("serves a buffered record on re-entry without another rpc fetch", async () => {
    const { source, pool } = setup({ startHeight: 2_000, endHeight: 2_999 });

    const first = await source.getRecord(2_000);
    const second = await source.getRecord(2_000);

    expect(second).toBe(first);
    expect(pool.getBlock).toHaveBeenCalledTimes(1);
  });

  it("evicts a range left behind by the ascending walk", async () => {
    const { source, archive } = setup({ startHeight: 1_000, endHeight: 3_999 });

    for (let height = 1_000; height <= 3_999; height++) {
      await source.getRecord(height);
    }
    await source.getRecord(1_500);

    expect(archive.getChunk).toHaveBeenCalledTimes(4);
  });

  describe("when the archive is disabled", () => {
    it("fetches straight from rpc without touching the archive", async () => {
      const { source, archive, pool } = setup({ startHeight: 2_000, endHeight: 2_999, disabled: true });

      const record = await source.getRecord(2_000);

      expect(record.height).toBe(2_000);
      expect(pool.getBlock).toHaveBeenCalledWith(2_000);
      expect(archive.getChunk).not.toHaveBeenCalled();
      expect(archive.putStagedBlockIfAbsent).not.toHaveBeenCalled();
    });
  });

  function setup(input: { startHeight: number; endHeight: number; disabled?: boolean }) {
    const archive = mock<BlockArchiveService>();
    archive.isEnabled.mockReturnValue(!input.disabled);
    archive.getChunk.mockResolvedValue(null);
    archive.getStagedBlock.mockResolvedValue(null);
    archive.putChunkIfAbsent.mockResolvedValue(undefined);
    archive.putStagedBlockIfAbsent.mockResolvedValue(undefined);
    archive.deleteStagedBlocks.mockResolvedValue(undefined);

    const pool = mock<RpcClientPool>();
    pool.getBlock.mockImplementation(async height => buildRecord(height).block);
    pool.getBlockResults.mockImplementation(async height => buildRecord(height).block_results);

    const logger = mock<LoggerService>();
    const source = new ArchiveBlockSource({ archive, pool, logger, startHeight: input.startHeight, endHeight: input.endHeight });

    return { source, archive, pool, logger };
  }

  function buildChunkRecords(range: ChunkRange): RawBlockRecord[] {
    return Array.from({ length: range.end - range.start + 1 }, (_, index) => buildRecord(range.start + index));
  }

  function buildRecord(height: number): RawBlockRecord {
    return {
      height,
      block: {
        block_id: { hash: `HASH-${height}` },
        block: {
          header: { height: String(height), time: "2026-08-12T00:00:00Z", proposer_address: "PROP" },
          data: { txs: [] }
        }
      },
      block_results: { height: String(height), txs_results: null }
    };
  }
});
