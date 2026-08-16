/**
 * Uint64 fields reach canonical JSON in three shapes depending on the proto era: the chain SDK's
 * patched codegen decodes them to bigint (serialized as a digit string), plain ts-proto uses
 * number, and the frozen legacy @akashnetwork/akash-api decodes to a protobufjs Long, which
 * JSON-serializes as its internal `{ low, high, unsigned }` fields.
 */
export function asUint64String(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return String(value);
  }
  if (isLongObject(value)) {
    return ((BigInt(value.high >>> 0) << 32n) | BigInt(value.low >>> 0)).toString();
  }
  return null;
}

function isLongObject(value: unknown): value is { low: number; high: number } {
  return typeof value === "object" && value !== null && "low" in value && "high" in value && typeof value.low === "number" && typeof value.high === "number";
}
