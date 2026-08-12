import type { RawBlockRecord } from "@src/archive/archive-layout";

export function buildRawBlockRecord(height: number, extra?: Record<string, string>): RawBlockRecord {
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
