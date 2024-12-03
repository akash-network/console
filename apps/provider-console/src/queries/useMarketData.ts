import { QueryKey, useQuery, UseQueryOptions } from "react-query";

import { MarketData } from "@src/types";
import { QueryKeys } from "./queryKeys";

async function getMarketData(): Promise<any> {
  return {};
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<MarketData, Error>(QueryKeys.getFinancialDataKey(), () => getMarketData(), options);
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
  return useQuery<{ aktPrice: string }, Error>(
    [...QueryKeys.getFinancialDataKey(), 'akt-price'],
    () => getAKTPrice(),
    {
      refetchInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
      ...options
    }
  );
}

