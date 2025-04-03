import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import type { MarketData } from "@src/types";
import { QueryKeys } from "./queryKeys";

async function getMarketData(): Promise<any> {
  return {};
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<MarketData, Error>({
    queryKey: QueryKeys.getFinancialDataKey(),
    queryFn: getMarketData,
    ...options
  });
}

async function getAKTPrice(): Promise<{ aktPrice: string }> {
  const response = await fetch("https://api.coingecko.com/api/v3/coins/akash-network/tickers");
  const data = await response.json();
  const coinbasePrice = data.tickers.find((ticker: any) => ticker.market.name === "Coinbase Exchange");
  return {
    aktPrice: coinbasePrice ? coinbasePrice.converted_last.usd.toFixed(2) : "N/A"
  };
}

export function useAKTData(options?: Omit<UseQueryOptions<{ aktPrice: string }, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<{ aktPrice: string }, Error>({
    queryKey: [...QueryKeys.getFinancialDataKey(), "akt-price"],
    queryFn: getAKTPrice,
    refetchInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
    ...options
  });
}
