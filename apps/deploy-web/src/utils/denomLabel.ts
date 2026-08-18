import { UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";

const USDC_DENOMS = new Set<string>(Object.values(USDC_IBC_DENOMS));

/** Every Akash chain denom (uakt, uact, and the USDC IBC denoms) uses 6 decimals. */
const DENOM_DECIMALS = 6;

/** Maps a chain denom to its human display symbol and decimal precision for base-unit conversion. */
export function getDenomLabel(denom: string): { symbol: string; decimals: number } {
  if (denom === UAKT_DENOM) return { symbol: "AKT", decimals: DENOM_DECIMALS };
  if (denom === UACT_DENOM) return { symbol: "ACT", decimals: DENOM_DECIMALS };
  if (USDC_DENOMS.has(denom)) return { symbol: "USDC", decimals: DENOM_DECIMALS };
  return { symbol: denom, decimals: DENOM_DECIMALS };
}
