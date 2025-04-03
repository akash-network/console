import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { DashboardData } from "@/types";

async function getDashboardData(): Promise<DashboardData> {
  const response = await axios.get(ApiUrlService.dashboardData());
  return response.data;
}

export function useDashboardData(options?: Omit<UseQueryOptions<DashboardData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<DashboardData, Error>({
    queryKey: QueryKeys.getDashboardDataKey(),
    queryFn: getDashboardData,
    ...options
  });
}
