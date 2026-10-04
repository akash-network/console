import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { GpuVendor, ProviderGpuInventory } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useGpuModels(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getGpuModelsKey(),
    queryFn: () => publicConsoleApiHttpClient.get<GpuVendor[]>(ApiUrlService.gpuModels()).then(response => response.data),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

export function useProviderGpus(providerAddress: string) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderGpusKey(providerAddress),
    queryFn: () => publicConsoleApiHttpClient.get<ProviderGpuInventory>(ApiUrlService.providerGpus(providerAddress)).then(response => response.data)
  });
}
