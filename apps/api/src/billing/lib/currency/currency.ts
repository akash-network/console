const CENTS_PER_USD = 100;

/** Wallet-setting amounts are persisted as integer cents; the API and domain layers speak whole USD. */
export function usdToCents(usd: number): number {
  return Math.round(usd * CENTS_PER_USD);
}

export function centsToUsd(cents: number): number {
  return cents / CENTS_PER_USD;
}
