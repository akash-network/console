import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { GpuVendor, ProviderGpuInventory, TrialGpuAvailability } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

/** Matches the API's own cache of the answer, so refetching sooner can only return the same list. */
const TRIAL_GPU_AVAILABILITY_STALE_TIME_MS = 60_000;

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

export function useTrialGpuAvailability() {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getTrialGpuAvailabilityKey(),
    queryFn: () => publicConsoleApiHttpClient.get<{ data: TrialGpuAvailability[] }>(ApiUrlService.trialGpuAvailability()).then(response => response.data.data),
    staleTime: TRIAL_GPU_AVAILABILITY_STALE_TIME_MS
  });
}
