function replacer(this: unknown, key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
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
