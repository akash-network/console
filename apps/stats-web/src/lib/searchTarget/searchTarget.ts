import { fromBech32, normalizeBech32 } from "@cosmjs/encoding";

export type SearchTarget =
  | { type: "block"; height: number }
  | { type: "transaction"; hash: string }
  | { type: "address"; address: string }
  | { type: "validator"; address: string };

export function toSearchTarget(searchTerms: string): SearchTarget | null {
  const search = searchTerms.trim();

  if (/^[0-9]+$/.test(search)) {
    return { type: "block", height: parseInt(search, 10) };
  }

  if (/^[A-Fa-f0-9]{64}$/.test(search)) {
    return { type: "transaction", hash: search.toUpperCase() };
  }

  const prefix = bech32PrefixOf(search);

  if (prefix === "akash") {
    return { type: "address", address: normalizeBech32(search) };
  }

  if (prefix === "akashvaloper") {
    return { type: "validator", address: normalizeBech32(search) };
  }

  return null;
}

function bech32PrefixOf(search: string) {
  try {
    return fromBech32(search).prefix;
  } catch {
    return null;
  }
}
