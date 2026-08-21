/** JSON.stringify calls toJSON before the replacer, so the pre-toJSON value is read from the holder (`this`) to serialize Buffers as base64 instead of Buffer#toJSON output. */
function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const original = this[key];

  if (typeof original === "bigint") {
    return original.toString();
  }
  if (original instanceof Uint8Array) {
    return Buffer.from(original).toString("base64");
  }
  return value;
}

/** Serializes a decoded proto message into plain JSON, returning null when it exceeds maxBytes. */
export function toCanonicalJson(value: unknown, maxBytes: number): unknown | null {
  const json = JSON.stringify(value, replacer);

  if (json === undefined || Buffer.byteLength(json) > maxBytes) {
    return null;
  }

  return JSON.parse(json);
}
