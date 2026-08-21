/**
 * Uint64 fields reach canonical JSON in three shapes depending on the proto era: the chain SDK's
 * patched codegen decodes them to bigint (serialized as a digit string), plain ts-proto uses
 * number, and the frozen legacy @akashnetwork/akash-api decodes to a protobufjs Long, which
 * JSON-serializes as its internal `{ low, high, unsigned }` fields.
 */
const UINT64_MAX = 2n ** 64n - 1n;

export function asUint64String(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed <= UINT64_MAX ? parsed.toString() : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (isLongObject(value)) {
    return ((BigInt(value.high >>> 0) << 32n) | BigInt(value.low >>> 0)).toString();
  }
  return null;
}

/** protobufjs stores each half as a signed 32-bit int, so accept the full 32-bit range; anything wider would silently truncate under `>>> 0`. */
function isInt32Half(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -2_147_483_648 && value <= 4_294_967_295;
}

function isLongObject(value: unknown): value is { low: number; high: number } {
  return typeof value === "object" && value !== null && "low" in value && "high" in value && isInt32Half(value.low) && isInt32Half(value.high);
}
