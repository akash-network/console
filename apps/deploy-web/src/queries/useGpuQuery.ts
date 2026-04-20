import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { GpuPricesResponse, GpuVendor } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

const staleQueryOptions = {
  refetchInterval: false,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false
} as const;

export function useGpuModels(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getGpuModelsKey(),
    queryFn: () => publicConsoleApiHttpClient.get<GpuVendor[]>(ApiUrlService.gpuModels()).then(response => response.data),
    ...options,
    ...staleQueryOptions
  });
}

export function useGpuPrices(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getGpuPricesKey(),
    queryFn: () => publicConsoleApiHttpClient.get<GpuPricesResponse>(ApiUrlService.gpuPrices()).then(response => response.data),
    ...options,
    ...staleQueryOptions
  });
}
