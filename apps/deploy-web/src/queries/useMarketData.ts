import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";

import { MarketData } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getMarketData(): Promise<MarketData> {
  const response = await axios.get(ApiUrlService.marketData());
  return response.data;
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, MarketData, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: QueryKeys.getFinancialDataKey(),
    queryFn: getMarketData,
    ...options,
  });
}