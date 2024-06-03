"use client";

import React from "react";

import { useUsdcDenom } from "@/hooks/useDenom";
import { uAktDenom } from "@/lib/constants";
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
  uaktToUSD: (amount: number) => 0, // Provide an actual implementation for uaktToUSD
  aktToUSD: (amount: number) => 0, // Provide an actual implementation for aktToUSD
  getPriceForDenom: (denom: string) => 0 // Provide an actual implementation for getPriceForDenom
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
      case uAktDenom:
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
