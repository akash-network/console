import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

export function getAmountFromCoinArray(coins: Coin[], denom: string): number {
  const coin = coins.find(coin => coin.denom === denom);
  return coin ? parseInt(coin.amount) : 0;
}

export function getAmountFromCoin(coin: Coin, denom?: string): number {
  if (denom && coin.denom !== denom) {
    return 0;
  }

  return parseInt(coin.amount);
}
