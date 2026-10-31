const LONE_SURROGATE = /\p{Cs}/gu;

/** Postgres refuses NUL in text and jsonb, and lone surrogates in jsonb, so one such character in a chain string would fail the whole statement it travels in. */
export function toStorableChainString(value: string): string {
  return value.replaceAll("\0", "").replace(LONE_SURROGATE, "");
}
