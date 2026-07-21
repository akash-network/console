import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import add from "date-fns/add";

import { READABLE_DENOMS, UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import networkStore from "@src/store/networkStore";
import { averageDaysInMonth } from "./dateUtils";
import { denomToUdenom, udenomToDenom } from "./mathHelpers";

export const averageBlockTime = 6.098;

/** Converts a per-block price to its hourly rate. Block time is in seconds, so there are `3600 / averageBlockTime` blocks per hour. */
export function perBlockToHourly(perBlockValue: number): number {
  return perBlockValue * (60 / averageBlockTime) * 60;
}

export const getUsdcDenom = (networkId?: NetworkId): string => {
  return USDC_IBC_DENOMS[networkId ?? (networkStore.selectedNetworkId as keyof typeof USDC_IBC_DENOMS)] as string;
};

/** @deprecated use udenomToDenom */
export function uaktToAKT(amount: number, precision = 3) {
  return udenomToDenom(amount, precision);
}

/** @deprecated use denomToUdenom */
export function aktToUakt(amount: number | string) {
  return denomToUdenom(String(amount));
}

export function coinToUDenom(coin: Coin) {
  let value: number | null;
  const usdcDenom = getUsdcDenom();

  if (coin.denom === "akt" || coin.denom === "act") {
    value = denomToUdenom(coin.amount);
  } else if (coin.denom === UAKT_DENOM || coin.denom === usdcDenom || coin.denom === UACT_DENOM) {
    value = parseFloat(coin.amount);
  } else {
    throw Error("Unrecognized denom: " + coin.denom);
  }

  return value;
}

export function coinToDenom(coin: Coin) {
  let value: number | null;
  const usdcDenom = getUsdcDenom();

  if (coin.denom === "akt" || coin.denom === "act") {
    value = parseFloat(coin.amount);
  } else if (coin.denom === UAKT_DENOM || coin.denom === usdcDenom || coin.denom === UACT_DENOM) {
    value = udenomToDenom(coin.amount);
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
