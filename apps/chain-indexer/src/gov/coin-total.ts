import type { FeeCoin } from "@src/db/schema";

/** Sums coin amounts by denom, dropping zero totals and sorting by denom so re-derivation of the same inputs is deterministic. */
export function sumFeeCoins(coins: FeeCoin[]): FeeCoin[] {
  const totalsByDenom = new Map<string, bigint>();
  for (const coin of coins) {
    totalsByDenom.set(coin.denom, (totalsByDenom.get(coin.denom) ?? 0n) + BigInt(coin.amount));
  }

  return [...totalsByDenom.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([denom, amount]) => ({ denom, amount: amount.toString() }));
}
