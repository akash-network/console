import { useBlock } from "@src/queries/useBlocksQuery";
import add from "date-fns/add";
import { averageDaysInMonth } from "./dateUtils";
import { Coin } from "@cosmjs/stargate";
import { denomToUdenom } from "./mathHelpers";
import { getUsdcDenom } from "@src/hooks/useDenom";
import { readableDenoms, uAktDenom } from "./constants";

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
    value = denomToUdenom(parseFloat(coin.amount));
  } else if (coin.denom === uAktDenom || coin.denom === usdcDenom) {
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
  } else if (coin.denom === uAktDenom || coin.denom === usdcDenom) {
    value = uaktToAKT(parseFloat(coin.amount), 6);
  } else {
    throw Error("Unrecognized denom: " + coin.denom);
  }

  return value;
}

export function getAvgCostPerMonth(pricePerBlock: number) {
  const averagePrice = (pricePerBlock * averageDaysInMonth * 24 * 60 * 60) / averageBlockTime;
  return averagePrice;
}

export function getTimeLeft(pricePerBlock: number, balance: number) {
  const blocksLeft = balance / pricePerBlock;
  const timestamp = new Date().getTime();
  return add(new Date(timestamp), { seconds: blocksLeft * averageBlockTime });
}

export function useRealTimeLeft(pricePerBlock: number, balance: number, settledAt: number, createdAt: number) {
  const { data: latestBlock } = useBlock("latest", {
    refetchInterval: 30000
  });
  if (!latestBlock) return;

  const latestBlockHeight = latestBlock.block.header.height;
  const blocksPassed = Math.abs(settledAt - latestBlockHeight);
  const blocksSinceCreation = Math.abs(createdAt - latestBlockHeight);

  const blocksLeft = balance / pricePerBlock - blocksPassed;
  const timestamp = new Date().getTime();

  return {
    timeLeft: add(new Date(timestamp), { seconds: blocksLeft * averageBlockTime }),
    escrow: Math.max(blocksLeft * pricePerBlock, 0),
    amountSpent: Math.min(blocksSinceCreation * pricePerBlock, balance)
  };
}

export function toReadableDenom(denom: string) {
  return readableDenoms[denom];
}
