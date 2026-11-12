import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { SinkDashboardData } from "@/types";

async function getSinkDashboardData(): Promise<SinkDashboardData> {
  const response = await axios.get(ApiUrlService.sinkDashboardData());
  return response.data;
}

export function useSinkDashboardData(options?: Omit<UseQueryOptions<SinkDashboardData, Error, SinkDashboardData, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<SinkDashboardData, Error>({
    queryKey: QueryKeys.getSinkDashboardDataKey(),
    queryFn: getSinkDashboardData,
    ...options
  });
}
