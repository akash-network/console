"use client";
import { useCallback, useMemo } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useMarketData } from "@src/queries";
import { roundDecimal, udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";

export function usePricing(): PricingContext {
  const { data: marketData, isLoading } = useMarketData({
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    networkMode: "offlineFirst"
  });
  const usdcIbcDenom = useUsdcDenom();

  function uaktToUSD(amount: number) {
    if (!marketData) return null;
    return roundDecimal((amount * marketData.price) / 1_000_000, 2);
  }

  function aktToUSD(amount: number) {
    if (!marketData) return null;
    return roundDecimal(amount * marketData.price, 2);
  }

  function usdToAkt(amount: number) {
    if (!marketData) return null;
    return roundDecimal(amount / marketData.price, 2);
  }

  const getPriceForDenom = (denom: string) => {
    switch (denom) {
      case UAKT_DENOM:
        return marketData?.price || 0;
      case usdcIbcDenom:
        return 1; // TODO Get price from API

      default:
        return 0;
    }
  };

  const udenomToUsd = useCallback(
    (amount: string | number, denom: string) => {
      let value = 0;
      const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);

      if (denom === UAKT_DENOM) {
        value = uaktToAKT(parsedAmount, 6) * (marketData?.price || 0);
      } else if (denom === usdcIbcDenom || denom === "usdc") {
        value = udenomToDenom(parsedAmount, 6);
      }

      return value;
    },
    [marketData?.price, usdcIbcDenom]
  );

  return useMemo(
    () => ({
      isLoaded: !!marketData,
      isLoading,
      price: marketData?.price,
      uaktToUSD,
      aktToUSD,
      usdToAkt,
      getPriceForDenom,
      udenomToUsd
    }),
    [isLoading, marketData?.price, usdcIbcDenom]
  );
}

export type PricingContext = {
  isLoaded: boolean;
  isLoading: boolean;
  price: number | undefined;
  uaktToUSD: (amount: number) => number | null;
  aktToUSD: (amount: number) => number | null;
  usdToAkt: (amount: number) => number | null;
  getPriceForDenom: (denom: string) => number;
  udenomToUsd: (amount: string | number, denom: string) => number;
};
