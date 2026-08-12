import { zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { decodeRecords, encodeRecords } from "@src/archive/archive-codec";
import type { RawBlockRecord } from "@src/archive/archive-layout";

describe(encodeRecords.name, () => {
  it("round-trips multiple records with nested and unicode content", () => {
    const records = [buildRecord(1, { memo: "héllo ✨" }), buildRecord(2, { memo: 'line\nbreak\tand "quotes"' })];

    expect(decodeRecords(encodeRecords(records))).toEqual(records);
  });

  it("produces a zstd frame", () => {
    const encoded = encodeRecords([buildRecord(1)]);

    expect([...encoded.subarray(0, 4)]).toEqual([0x28, 0xb5, 0x2f, 0xfd]);
  });

  it("escapes embedded newlines so every record stays on one NDJSON line", () => {
    const encoded = encodeRecords([buildRecord(1, { memo: "a\nb" }), buildRecord(2)]);
    const lines = zstdDecompressSync(encoded).toString("utf8").split("\n").filter(Boolean);

    expect(lines).toHaveLength(2);
  });
});

describe(decodeRecords.name, () => {
  it("tolerates a trailing newline", () => {
    const record = buildRecord(7);
    const buffer = zstdCompressSync(Buffer.from(`${JSON.stringify(record)}\n`));

    expect(decodeRecords(buffer)).toEqual([record]);
  });

  it("throws on a buffer that is not zstd", () => {
    expect(() => decodeRecords(Buffer.from("not zstd at all"))).toThrow();
  });
});

function buildRecord(height: number, extra?: Record<string, string>): RawBlockRecord {
  return {
    height,
    block: {
      block_id: { hash: `HASH-${height}` },
      block: {
        header: { height: String(height), time: "2026-08-12T00:00:00Z", proposer_address: "PROP" },
        data: { txs: extra ? [JSON.stringify(extra)] : [] }
      }
    },
    block_results: { height: String(height), txs_results: null }
  };
}
