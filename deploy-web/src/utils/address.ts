import { fromBech32 } from "@cosmjs/encoding";

export function isValidBech32Address(address: string, prefix?: string) {
  const bech32 = parseBech32(address);

  return bech32 && (!prefix || bech32.prefix === prefix);
}

export function parseBech32(str: string) {
  try {
    return fromBech32(str);
  } catch {
    return null;
  }
}
