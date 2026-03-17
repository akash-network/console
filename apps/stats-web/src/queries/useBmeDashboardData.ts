import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { BmeDashboardData } from "@/types";

async function getBmeDashboardData(): Promise<BmeDashboardData> {
  const response = await axios.get(ApiUrlService.bmeDashboardData());
  return response.data;
}

export function useBmeDashboardData(options?: Omit<UseQueryOptions<BmeDashboardData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<BmeDashboardData, Error>({
    queryKey: QueryKeys.getBmeDashboardDataKey(),
    queryFn: getBmeDashboardData,
    ...options
  });
}
