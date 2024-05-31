import { UseQueryOptions, useQuery, QueryKey } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { DashboardData } from "@/types";
import { ApiUrlService } from "@/lib/apiUtils";

async function getDashboardData(): Promise<DashboardData> {
  const response = await axios.get(ApiUrlService.dashboardData());
  return response.data;
}

export function useDashboardData(options?: Omit<UseQueryOptions<DashboardData, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<DashboardData, Error>(QueryKeys.getDashboardDataKey(), () => getDashboardData(), options);
}
