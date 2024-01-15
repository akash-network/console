import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { MarketData } from "@/types";
import { ApiUrlService } from "@/lib/apiUtils";

async function getMarketData(): Promise<MarketData> {
  const response = await axios.get(ApiUrlService.marketData());
  return response.data;
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<MarketData, Error>(QueryKeys.getFinancialDataKey(), () => getMarketData(), options);
}
