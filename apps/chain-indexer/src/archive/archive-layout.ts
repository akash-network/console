import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import type { RpcBlockResult, RpcBlockResultsResult } from "@src/rpc/rpc-types";

export const CHUNK_SIZE = 1_000;

/** Padding width for heights in object keys; 10 digits keeps keys lexicographically sortable past height 9,999,999,999. */
const HEIGHT_PAD_WIDTH = 10;

/** One archived block: the verbatim raw RPC payloads of /block and /block_results plus the height they belong to. */
export interface RawBlockRecord {
  height: number;
  block: RpcBlockResult;
  block_results: RpcBlockResultsResult;
}

/** Fetches the raw /block and /block_results payloads for a height in parallel and pairs them into one record. */
export async function fetchRawBlock(pool: RpcClientPool, height: number): Promise<RawBlockRecord> {
  const [block, blockResults] = await Promise.all([pool.getBlock(height), pool.getBlockResults(height)]);
  return { height, block, block_results: blockResults };
}

export interface ChunkRange {
  start: number;
  end: number;
}

export function chunkRangeFor(height: number): ChunkRange {
  const start = Math.floor(height / CHUNK_SIZE) * CHUNK_SIZE;
  return { start, end: start + CHUNK_SIZE - 1 };
}

export function isRangeContained(range: ChunkRange, startHeight: number, endHeight: number): boolean {
  return range.start >= startHeight && range.end <= endHeight;
}

export function chunkKey(chainId: string, range: ChunkRange): string {
  return `${chainId}/chunks/${padHeight(range.start)}-${padHeight(range.end)}.ndjson.zst`;
}

export function stagedBlockKey(chainId: string, height: number): string {
  return `${chainId}/blocks/${padHeight(height)}.json.zst`;
}

function padHeight(height: number): string {
  return String(height).padStart(HEIGHT_PAD_WIDTH, "0");
}
