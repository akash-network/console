import type { Coin } from "@cosmjs/proto-signing";

export function getAmountFromCoinArray(coins: Coin[], denom: string): string {
  const coin = coins.find(coin => coin.denom === denom);
  return coin ? coin.amount : "0";
}

export function getAmountFromCoin(coin: Coin | undefined, denom?: string): string {
  if (!coin || (denom && coin.denom !== denom)) {
    return "0";
  }

  return coin.amount;
}
