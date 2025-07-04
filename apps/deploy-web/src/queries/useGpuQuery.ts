import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { GpuVendor } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useGpuModels(options = {}) {
  const { axios } = useServices();
  return useQuery({
    queryKey: QueryKeys.getGpuModelsKey(),
    queryFn: () => axios.get<GpuVendor[]>(ApiUrlService.gpuModels()).then(response => response.data),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}
