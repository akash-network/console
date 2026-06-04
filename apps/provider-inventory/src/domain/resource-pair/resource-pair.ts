import type { RawPair } from "@src/types/inventory";

const UNLIMITED = -1n;
export const MAX_INT64 = 9223372036854775807n;

export function availableCapacity(pair: RawPair): bigint {
  if (pair.allocatable === UNLIMITED) return MAX_INT64;
  const allocatable = typeof pair.allocatable === "bigint" ? pair.allocatable : BigInt(pair.allocatable);
  const allocated = typeof pair.allocated === "bigint" ? pair.allocated : BigInt(pair.allocated);
  const diff = allocatable - allocated;
  return diff > 0n ? diff : 0n;
}

export function canAllocate(pair: RawPair, val: bigint): boolean {
  return availableCapacity(pair) >= val;
}
