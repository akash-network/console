export interface CoinAmount {
  denom: string;
  amount: bigint;
}

const COIN_PATTERN = /^(\d+)(.+)$/;

/**
 * Parses a Cosmos coin string such as `"100uakt,5uatom"` into typed amounts. Amounts are `bigint` so
 * u-denom values above `Number.MAX_SAFE_INTEGER` keep full precision. Denoms may contain slashes
 * (ibc/factory), so the split is on the comma and the amount is the leading integer run only.
 */
export function parseCoins(value: string): CoinAmount[] {
  const coins: CoinAmount[] = [];

  for (const segment of value.split(",")) {
    const match = segment.trim().match(COIN_PATTERN);
    if (match) {
      coins.push({ amount: BigInt(match[1]), denom: match[2] });
    }
  }

  return coins;
}
