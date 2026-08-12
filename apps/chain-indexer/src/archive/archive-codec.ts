import { constants, zstdCompressSync, zstdDecompressSync } from "node:zlib";

import type { RawBlockRecord } from "@src/archive/archive-layout";

/** Level 3 is zstd's default: ~3-4x compression on block JSON at negligible CPU next to RPC latency. */
const ZSTD_LEVEL = 3;

export function encodeRecords(records: RawBlockRecord[]): Buffer {
  const ndjson = records.map(record => JSON.stringify(record)).join("\n");
  return zstdCompressSync(Buffer.from(`${ndjson}\n`), { params: { [constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL } });
}

export function decodeRecords(buffer: Buffer): RawBlockRecord[] {
  return zstdDecompressSync(buffer)
    .toString("utf8")
    .split("\n")
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as RawBlockRecord);
}
