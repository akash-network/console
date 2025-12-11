import { fromBase64 as cosmjsFromBase64, toBase64 as cosmjsToBase64 } from "@cosmjs/encoding";

export function toBase64(data: Uint8Array | string): string {
  if (typeof data === "string") {
    return btoa(data);
  }

  if ("toBase64" in data && typeof data.toBase64 === "function") {
    return data.toBase64();
  }

  return cosmjsToBase64(data);
}

export function fromBase64(data: string): Uint8Array {
  if ("fromBase64" in Uint8Array && typeof Uint8Array.fromBase64 === "function") {
    return Uint8Array.fromBase64(data);
  }

  return cosmjsFromBase64(data);
}

export function fromBase64Url(data: string): Uint8Array {
  let value = data.replace(/-/g, "+").replace(/_/g, "/");
  value = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return fromBase64(value);
}
