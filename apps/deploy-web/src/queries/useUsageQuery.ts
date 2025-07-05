import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import format from "date-fns/format";

import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

type UsageParams = {
  address: string;
  startDate?: Date;
  endDate?: Date;
};

async function getUsage(params: UsageParams): Promise<UsageHistory> {
  const response = await axios.get(ApiUrlService.usage(), {
    params: {
      address: params.address,
      startDate: params.startDate ? format(params.startDate, "y-MM-dd") : undefined,
      endDate: params.endDate ? format(params.endDate, "y-MM-dd") : undefined
    }
  });

  return response.data;
}

export function useUsage(params: UsageParams, options?: Omit<UseQueryOptions<UsageHistory, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<UsageHistory, Error>({
    queryKey: [...QueryKeys.getUsageDataKey(), params.address, params.startDate?.toISOString(), params.endDate?.toISOString()],
    queryFn: () => getUsage(params),
    ...options
  });
}

async function getUsageStats(params: UsageParams): Promise<UsageHistoryStats> {
  const response = await axios.get(ApiUrlService.usageStats(), {
    params: {
      address: params.address,
      startDate: params.startDate ? format(params.startDate, "y-MM-dd") : undefined,
      endDate: params.endDate ? format(params.endDate, "y-MM-dd") : undefined
    }
  });

  return response.data;
}

export function useUsageStats(params: UsageParams, options?: Omit<UseQueryOptions<UsageHistoryStats, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<UsageHistoryStats, Error>({
    queryKey: [...QueryKeys.getUsageStatsDataKey(), params.address, params.startDate?.toISOString(), params.endDate?.toISOString()],
    queryFn: () => getUsageStats(params),
    ...options
  });
}
