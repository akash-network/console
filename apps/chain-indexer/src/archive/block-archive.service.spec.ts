import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RawBlockRecord } from "@src/archive/archive-layout";
import { BlockArchiveService } from "@src/archive/block-archive.service";
import { envSchema } from "@src/config/env.config";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcStatusResult } from "@src/rpc/rpc-types";

import { httpError, InMemoryObjectStore } from "@test/fakes/in-memory-object-store";

describe(BlockArchiveService.name, () => {
  it("reports enabled when constructed with a store", () => {
    const { service } = setup();

    expect(service.isEnabled()).toBe(true);
  });

  it("writes staged blocks under the zero-padded per-chain key", async () => {
    const { service, store } = setup();

    await service.putStagedBlockIfAbsent(buildRecord(1_234));

    expect([...store.objects.keys()]).toEqual(["raw-blocks/sandbox-01/blocks/0000001234.json.zst"]);
  });

  it("writes chunks under the zero-padded per-chain range key", async () => {
    const { service, store } = setup();

    await service.putChunkIfAbsent({ start: 2_000, end: 2_999 }, buildChunkRecords(2_000, 2_999));

    expect([...store.objects.keys()]).toEqual(["raw-blocks/sandbox-01/chunks/0000002000-0000002999.ndjson.zst"]);
  });

  it("rejects a chunk put whose records do not cover the range", async () => {
    const { service, store } = setup();

    await expect(service.putChunkIfAbsent({ start: 2_000, end: 2_999 }, [buildRecord(2_000)])).rejects.toThrow("1000 records");

    expect(store.objects.size).toBe(0);
  });

  it("round-trips a staged block", async () => {
    const { service } = setup();
    const record = buildRecord(42);

    await service.putStagedBlockIfAbsent(record);

    await expect(service.getStagedBlock(42)).resolves.toEqual(record);
  });

  it("round-trips a chunk", async () => {
    const { service } = setup();
    const records = buildChunkRecords(2_000, 2_999);

    await service.putChunkIfAbsent({ start: 2_000, end: 2_999 }, records);

    await expect(service.getChunk({ start: 2_000, end: 2_999 })).resolves.toEqual(records);
  });

  it("logs the bucket when enabled", () => {
    const { service, logger } = setup();

    service.logState();

    expect(logger.info).toHaveBeenCalledWith({ event: "ARCHIVE_ENABLED", bucket: "raw-blocks" });
  });

  it("keeps the original object when the same staged block is put twice", async () => {
    const { service, store } = setup();
    const original = buildRecord(42);
    const replay = { ...buildRecord(42), block_results: { height: "42", txs_results: [{ code: 1 }] } };

    await service.putStagedBlockIfAbsent(original);
    await expect(service.putStagedBlockIfAbsent(replay)).resolves.toBeUndefined();

    await expect(service.getStagedBlock(42)).resolves.toEqual(original);
    expect(store.objects.size).toBe(1);
  });

  it("returns null for a missing chunk", async () => {
    const { service } = setup();

    await expect(service.getChunk({ start: 0, end: 999 })).resolves.toBeNull();
  });

  it("returns null for a missing staged block", async () => {
    const { service } = setup();

    await expect(service.getStagedBlock(7)).resolves.toBeNull();
  });

  it("propagates non-404 download errors", async () => {
    const { service, store } = setup();
    store.failNextDownloadWith = httpError(500, "backend blew up");

    await expect(service.getChunk({ start: 0, end: 999 })).rejects.toThrow("backend blew up");
  });

  it("propagates non-412 save errors", async () => {
    const { service, store } = setup();
    store.failNextSaveWith = httpError(503, "unavailable");

    await expect(service.putStagedBlockIfAbsent(buildRecord(1))).rejects.toThrow("unavailable");
  });

  it("deletes staged blocks best-effort without throwing on failures", async () => {
    const { service, store, logger } = setup();
    await service.putStagedBlockIfAbsent(buildRecord(1));
    await service.putStagedBlockIfAbsent(buildRecord(2));
    store.failNextDeleteWith = httpError(503, "unavailable");

    await expect(service.deleteStagedBlocks([1, 2, 3])).resolves.toBeUndefined();

    expect(store.objects.size).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ARCHIVE_STAGED_DELETE_FAILED" }));
  });

  it("skips staged deletes when the chain id cannot be resolved", async () => {
    const { service, pool, logger } = setup();
    pool.getStatus.mockRejectedValue(new Error("rpc down"));

    await expect(service.deleteStagedBlocks([1])).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ARCHIVE_STAGED_DELETE_FAILED", reason: "chain id unavailable" }));
  });

  it("fetches the chain id once across concurrent puts", async () => {
    const { service, pool } = setup();

    await Promise.all([service.putStagedBlockIfAbsent(buildRecord(1)), service.putStagedBlockIfAbsent(buildRecord(2))]);

    expect(pool.getStatus).toHaveBeenCalledTimes(1);
  });

  it("refetches the chain id after a failed status call", async () => {
    const { service, pool } = setup();
    pool.getStatus.mockRejectedValueOnce(new Error("rpc down"));

    await expect(service.putStagedBlockIfAbsent(buildRecord(1))).rejects.toThrow("rpc down");
    await expect(service.putStagedBlockIfAbsent(buildRecord(1))).resolves.toBeUndefined();

    expect(pool.getStatus).toHaveBeenCalledTimes(2);
  });

  it("refetches the chain id after a malformed status response poisons the first call", async () => {
    const { service, pool } = setup();
    pool.getStatus.mockResolvedValueOnce({ sync_info: { latest_block_height: "1" } } as unknown as RpcStatusResult);

    await expect(service.putStagedBlockIfAbsent(buildRecord(1))).rejects.toThrow();
    await expect(service.putStagedBlockIfAbsent(buildRecord(1))).resolves.toBeUndefined();

    expect(pool.getStatus).toHaveBeenCalledTimes(2);
  });

  describe("when the archive is disabled", () => {
    it("reports disabled", () => {
      const { service } = setup({ disabled: true });

      expect(service.isEnabled()).toBe(false);
    });

    it("rejects reads and writes", async () => {
      const { service } = setup({ disabled: true });

      await expect(service.getChunk({ start: 0, end: 999 })).rejects.toThrow("disabled");
      await expect(service.putStagedBlockIfAbsent(buildRecord(1))).rejects.toThrow("disabled");
    });

    it("resolves staged deletes as a no-op", async () => {
      const { service } = setup({ disabled: true });

      await expect(service.deleteStagedBlocks([1])).resolves.toBeUndefined();
    });

    it("logs the disabled state", () => {
      const { service, logger } = setup({ disabled: true });

      service.logState();

      expect(logger.info).toHaveBeenCalledWith({ event: "ARCHIVE_DISABLED" });
    });
  });

  function setup(input?: { disabled?: boolean }) {
    const store = new InMemoryObjectStore();
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      ARCHIVE_BUCKET: input?.disabled ? "" : "raw-blocks"
    });
    const pool = mock<RpcClientPool>();
    pool.getStatus.mockResolvedValue({ node_info: { network: "sandbox-01" }, sync_info: { latest_block_height: "1" } });
    const logger = mock<LoggerService>();
    const service = new BlockArchiveService(input?.disabled ? null : store, config, pool, logger);
    return { service, store, pool, logger };
  }

  function buildChunkRecords(fromHeight: number, toHeight: number): RawBlockRecord[] {
    return Array.from({ length: toHeight - fromHeight + 1 }, (_, index) => buildRecord(fromHeight + index));
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
