import type { CoinAmount } from "@src/pipeline/balance/coin-amount";

/** A denom whose chain-queried (`expected`) and ledger-derived (`actual`) amounts disagree. */
export interface CoinDiff {
  denom: string;
  expected: bigint;
  actual: bigint;
}

function toMap(coins: CoinAmount[]): Map<string, bigint> {
  return new Map(coins.map(coin => [coin.denom, coin.amount]));
}

/** Compares chain-queried balances (`expected`) against ledger-derived balances (`actual`), returning only the denoms that differ. */
export function diffCoins(expected: CoinAmount[], actual: CoinAmount[]): CoinDiff[] {
  const expectedByDenom = toMap(expected);
  const actualByDenom = toMap(actual);
  const denoms = [...new Set([...expectedByDenom.keys(), ...actualByDenom.keys()])].sort();

  const diffs: CoinDiff[] = [];
  for (const denom of denoms) {
    const expectedAmount = expectedByDenom.get(denom) ?? 0n;
    const actualAmount = actualByDenom.get(denom) ?? 0n;
    if (expectedAmount !== actualAmount) {
      diffs.push({ denom, expected: expectedAmount, actual: actualAmount });
    }
  }

  return diffs;
}
