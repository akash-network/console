import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { MarketData } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useMarketData(options?: Omit<UseQueryOptions<MarketData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { consoleApiHttpClient } = useServices();
  return useQuery<MarketData, Error>({
    queryKey: QueryKeys.getFinancialDataKey(),
    queryFn: () => consoleApiHttpClient.get<MarketData>(ApiUrlService.marketData()).then(response => response.data),
    ...options
  });
}
