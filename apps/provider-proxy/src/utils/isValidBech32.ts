import { fromBech32 } from "@cosmjs/encoding";

export function isValidBech32Address(address: string, prefix?: string): boolean {
  try {
    const bech32 = fromBech32(address);
    return !!bech32 && (!prefix || bech32.prefix === prefix);
  } catch {
    return false;
  }
}
