import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { GpuPricesResponse } from "@/types";

async function getGpuPrices(): Promise<GpuPricesResponse> {
  const response = await axios.get(ApiUrlService.gpuPrices());
  return response.data;
}

export function useGpuPrices(options?: Omit<UseQueryOptions<GpuPricesResponse, Error, GpuPricesResponse, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: QueryKeys.getGpuPricesKey(),
    queryFn: getGpuPrices,
    ...options
  });
}
