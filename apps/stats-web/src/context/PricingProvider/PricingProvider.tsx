"use client";

import React from "react";

import { UAKT_DENOM } from "@/config/denom.config";
import { useUsdcDenom } from "@/hooks/useDenom";
import { roundDecimal } from "@/lib/mathHelpers";
import { useMarketData } from "@/queries";

type ContextType = {
  isLoaded: boolean;
  isLoading: boolean;
  price: number;
  uaktToUSD: (amount: number) => number;
  aktToUSD: (amount: number) => number;
  getPriceForDenom: (denom: string) => number;
};

const PricingProviderContext = React.createContext<ContextType>({
  isLoaded: false,
  isLoading: false,
  price: 0,
  // TODO: Provide an actual implementation for the following functions
  uaktToUSD: () => 0,
  aktToUSD: () => 0,
  getPriceForDenom: () => 0
});

export const PricingProvider: React.FC<any> = ({ children }) => {
  const { data: marketData, isLoading } = useMarketData({ refetchInterval: 60_000 });
  const usdcIbcDenom = useUsdcDenom();

  function uaktToUSD(amount: number): number {
    if (!marketData) return 0;
    return roundDecimal((amount * marketData.price) / 1_000_000, 2);
  }

  function aktToUSD(amount: number): number {
    if (!marketData) return 0;
    return roundDecimal(amount * marketData.price, 2);
  }

  const getPriceForDenom = (denom: string): number => {
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
    <PricingProviderContext.Provider value={{ isLoaded: !!marketData, uaktToUSD, aktToUSD, price: marketData?.price || 0, isLoading, getPriceForDenom }}>
      {children}
    </PricingProviderContext.Provider>
  );
};

// Hook
export function usePricing() {
  return { ...React.useContext(PricingProviderContext) };
}
