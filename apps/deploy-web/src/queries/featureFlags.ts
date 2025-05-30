import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import networkStore from "@src/store/networkStore";
import { QueryKeys } from "./queryKeys";

const REFETCH_INTERVAL = 1000 * 60 * 5;
export function useFeatureFlags(options?: Omit<UseQueryOptions<Features>, "queryKey" | "queryFn">): UseQueryResult<Features> {
  const { axios, browserApiUrlService } = useServices();
  const networkId = networkStore.useSelectedNetworkId();
  return useQuery({
    ...options,
    queryKey: QueryKeys.getFeatureFlagsKey(networkId),
    queryFn: () => getFeatureFlags(networkId, axios, browserApiUrlService),
    refetchInterval: REFETCH_INTERVAL
  });
}

export interface Features {
  allowAnonymousUserTrial?: boolean;
}

export async function getFeatureFlags(networkId: NetworkId, axios: AxiosInstance, apiUrlService: ApiUrlService) {
  const baseApiUrl = apiUrlService.getBaseApiUrlFor(networkId);
  const response = await axios.get<{ data: Features }>(`${baseApiUrl}/v1/features`);
  return response.data.data;
}
