import { QueryKey, useQuery, UseQueryOptions } from "react-query";

import { MarketData } from "@src/types";
import { QueryKeys } from "./queryKeys";

async function getMarketData(): Promise<any> {
  return {};
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<MarketData, Error>(QueryKeys.getFinancialDataKey(), () => getMarketData(), options);
}
