const CENTS_PER_USD = 100;

const CENT_FORMAT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/** Wallet-setting amounts are persisted as integer cents; the API and domain layers speak whole USD. */
export function usdToCents(usd: number): number {
  return Math.round(usd * CENTS_PER_USD);
}

export function centsToUsd(cents: number): number {
  return cents / CENTS_PER_USD;
}

/** Rounds like Intl shows USD on screen, which `usdToCents` does not: it takes 1.005 to 1.00 where the screen shows $1.01. */
export function roundUsdToCentPrecision(usd: number): number {
  return Number(CENT_FORMAT.format(usd));
}
