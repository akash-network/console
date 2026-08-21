import { zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { decodeRecords, encodeRecords } from "@src/archive/archive-codec";

import { buildRawBlockRecord } from "@test/fakes/build-raw-block-record";

describe(encodeRecords.name, () => {
  it("round-trips multiple records with nested and unicode content", () => {
    const records = [buildRawBlockRecord(1, { memo: "héllo ✨" }), buildRawBlockRecord(2, { memo: 'line\nbreak\tand "quotes"' })];

    expect(decodeRecords(encodeRecords(records))).toEqual(records);
  });

  it("produces a zstd frame", () => {
    const encoded = encodeRecords([buildRawBlockRecord(1)]);

    expect([...encoded.subarray(0, 4)]).toEqual([0x28, 0xb5, 0x2f, 0xfd]);
  });

  it("escapes embedded newlines so every record stays on one NDJSON line", () => {
    const encoded = encodeRecords([buildRawBlockRecord(1, { memo: "a\nb" }), buildRawBlockRecord(2)]);
    const lines = zstdDecompressSync(encoded).toString("utf8").split("\n").filter(Boolean);

    expect(lines).toHaveLength(2);
  });
});

describe(decodeRecords.name, () => {
  it("tolerates a trailing newline", () => {
    const record = buildRawBlockRecord(7);
    const buffer = zstdCompressSync(Buffer.from(`${JSON.stringify(record)}\n`));

    expect(decodeRecords(buffer)).toEqual([record]);
  });

  it("throws on a buffer that is not zstd", () => {
    expect(() => decodeRecords(Buffer.from("not zstd at all"))).toThrow();
  });
});
