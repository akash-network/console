import { StringDecoder } from "node:string_decoder";

/** `write` without `end` never emits a partial character, so the kept text stays within the byte budget. */
export function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  return new StringDecoder("utf8").write(Buffer.from(text, "utf8").subarray(0, maxBytes));
}
