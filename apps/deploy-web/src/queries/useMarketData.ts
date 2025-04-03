import type { QueryKey, UseQueryOptions } from "react-query";
import { useQuery } from "react-query";
import axios from "axios";

import type { MarketData } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getMarketData(): Promise<MarketData> {
  const response = await axios.get(ApiUrlService.marketData());
  return response.data;
}

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<MarketData, Error>(QueryKeys.getFinancialDataKey(), () => getMarketData(), options);
}
