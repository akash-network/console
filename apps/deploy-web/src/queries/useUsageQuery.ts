import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { QueryKeys } from "./queryKeys";

type UsageParams = {
  address: string;
  startDate?: Date;
  endDate?: Date;
};

export function useUsage(params: UsageParams, options?: Omit<UseQueryOptions<UsageHistory, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { usage } = useServices();

  return useQuery<UsageHistory, Error>({
    queryKey: [...QueryKeys.getUsageDataKey(params.address, params.startDate?.toISOString(), params.endDate?.toISOString())],
    queryFn: () => usage.getUsage(params),
    ...options
  });
}

export function useUsageStats(params: UsageParams, options?: Omit<UseQueryOptions<UsageHistoryStats, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { usage } = useServices();

  return useQuery<UsageHistoryStats, Error>({
    queryKey: [...QueryKeys.getUsageStatsDataKey(params.address, params.startDate?.toISOString(), params.endDate?.toISOString())],
    queryFn: () => usage.getUsageStats(params),
    ...options
  });
}
