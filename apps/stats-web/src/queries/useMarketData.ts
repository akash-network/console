import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import { MarketData } from "@/types";

async function getMarketData(): Promise<MarketData> {
  const response = await axios.get(ApiUrlService.marketData());
  return response.data;
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: QueryKeys.getFinancialDataKey(),
    queryFn: () => getMarketData(),
    ...options
  });
}