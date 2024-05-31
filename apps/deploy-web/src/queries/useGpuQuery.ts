import { GpuVendor } from "@src/types/gpu";
import { ApiUrlService } from "@src/utils/apiUtils";
import axios from "axios";
import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";

async function getGpuModels() {
  const response = await axios.get(ApiUrlService.gpuModels());

  return response.data as GpuVendor[];
}

export function useGpuModels(options = {}) {
  return useQuery(QueryKeys.getGpuModelsKey(), () => getGpuModels(), {
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}
