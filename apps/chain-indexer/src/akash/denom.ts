/** The IBC denoms deployments are funded with, mapped to their base denom (mirrors the legacy indexer's mapping). */
export const DENOM_MAPPING = new Map<string, string>([
  ["uakt", "uakt"],
  ["uact", "uact"],
  ["ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E", "uusdc"],
  ["ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", "uusdc"]
]);

/**
 * Unknown denoms are stored raw instead of throwing (the legacy indexer aborts the block), so a new
 * funding denom degrades to an unmapped row rather than halting ingestion.
 */
export function normalizeDenom(denom: string): { denom: string; known: boolean } {
  const mapped = DENOM_MAPPING.get(denom);
  return mapped ? { denom: mapped, known: true } : { denom, known: false };
}
