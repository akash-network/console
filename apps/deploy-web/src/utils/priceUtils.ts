import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import add from "date-fns/add";

import { READABLE_DENOMS, UAKT_DENOM } from "@src/config/denom.config";
import { getUsdcDenom } from "@src/hooks/useDenom";
import { averageDaysInMonth } from "./dateUtils";
import { denomToUdenom } from "./mathHelpers";

export const averageBlockTime = 6.098;

export function uaktToAKT(amount: number, precision: number = 3) {
  return Math.round((amount / 1000000 + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function aktToUakt(amount: number | string) {
  return Math.round((typeof amount === "string" ? parseFloat(amount) : amount) * 1_000_000);
}

export function coinToUDenom(coin: Coin) {
  let value: number | null = null;
  const usdcDenom = getUsdcDenom();

  if (coin.denom === "akt") {
    value = denomToUdenom(coin.amount);
  } else if (coin.denom === UAKT_DENOM || coin.denom === usdcDenom) {
    value = parseFloat(coin.amount);
  } else {
    throw Error("Unrecognized denom: " + coin.denom);
  }

  return value;
}

export function coinToDenom(coin: Coin) {
  let value: number | null = null;
  const usdcDenom = getUsdcDenom();

  if (coin.denom === "akt") {
    value = parseFloat(coin.amount);
  } else if (coin.denom === UAKT_DENOM || coin.denom === usdcDenom) {
    value = uaktToAKT(parseFloat(coin.amount), 6);
  } else {
    throw Error("Unrecognized denom: " + coin.denom);
  }

  return value;
}

export function getAvgCostPerMonth(pricePerBlock: number) {
  return (pricePerBlock * averageDaysInMonth * 24 * 60 * 60) / averageBlockTime;
}

export function getTimeLeft(pricePerBlock: number, balance: number) {
  const blocksLeft = balance / pricePerBlock;
  const timestamp = new Date().getTime();
  return add(new Date(timestamp), { seconds: blocksLeft * averageBlockTime });
}

export function toReadableDenom(denom: string) {
  return READABLE_DENOMS[denom];
}
