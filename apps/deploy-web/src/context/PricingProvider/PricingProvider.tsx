"use client";
import React from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useMarketData } from "@src/queries";
import { roundDecimal } from "@src/utils/mathHelpers";

type ContextType = {
  isLoaded: boolean;
  isLoading: boolean;
  price: number | undefined;
  uaktToUSD: (amount: number) => number | null;
  aktToUSD: (amount: number) => number | null;
  usdToAkt: (amount: number) => number | null;
  getPriceForDenom: (denom: string) => number;
};

const PricingProviderContext = React.createContext<ContextType>({} as ContextType);

export const PricingProvider = ({ children }) => {
  const { data: marketData, isLoading } = useMarketData({ refetchInterval: 60_000 });
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

  return (
    <PricingProviderContext.Provider value={{ isLoaded: !!marketData, uaktToUSD, aktToUSD, usdToAkt, price: marketData?.price, isLoading, getPriceForDenom }}>
      {children}
    </PricingProviderContext.Provider>
  );
};

// Hook
export function usePricing() {
  return { ...React.useContext(PricingProviderContext) };
}
