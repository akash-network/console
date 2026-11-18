import { fromBech32 } from "@cosmjs/encoding";

/** Account addresses hash to 20 bytes and module or contract addresses to 32, so any other length cannot name a provider. */
const ADDRESS_BYTE_LENGTHS = new Set([20, 32]);

export function isValidBech32Address(address: string, prefix?: string): boolean {
  try {
    const bech32 = fromBech32(address);
    return ADDRESS_BYTE_LENGTHS.has(bech32.data.length) && (!prefix || bech32.prefix === prefix);
  } catch {
    return false;
  }
}
