import React from "react";
import { roundDecimal } from "@src/utils/mathHelpers";
import { useMarketData } from "@src/queries";

type ContextType = {
  isLoaded: boolean;
  isLoading: boolean;
  price: number;
  uaktToUSD: (amount: number) => number;
  aktToUSD: (amount: number) => number;
};

const PricingProviderContext = React.createContext<ContextType>({
  isLoaded: false,
  isLoading: false,
  price: null,
  uaktToUSD: null,
  aktToUSD: null
});

export const PricingProvider = ({ children }) => {
  const { data: marketData, isLoading } = useMarketData({ refetchInterval: 60_000 });

  function uaktToUSD(amount: number) {
    if (!marketData) return null;
    return roundDecimal((amount * marketData.price) / 1_000_000, 2);
  }

  function aktToUSD(amount: number) {
    if (!marketData) return null;
    return roundDecimal(amount * marketData.price, 2);
  }

  return (
    <PricingProviderContext.Provider value={{ isLoaded: !!marketData, uaktToUSD, aktToUSD, price: marketData?.price, isLoading }}>
      {children}
    </PricingProviderContext.Provider>
  );
};

// Hook
export function usePricing() {
  return { ...React.useContext(PricingProviderContext) };
}
