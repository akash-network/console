import { QueryClient, useQuery, UseQueryOptions, UseQueryResult } from "react-query";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { MAINNET_ID, SANDBOX_ID } from "@akashnetwork/network-store";
import { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { ApiUrlService } from "@src/services/api-url/api-url.service";
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

export async function prefetchFeatureFlags(queryClient: QueryClient, axios: AxiosInstance, apiUrlService: ApiUrlService) {
  const networks: NetworkId[] = [SANDBOX_ID, MAINNET_ID];

  const promises = networks.map(networkId =>
    queryClient.prefetchQuery(QueryKeys.getFeatureFlagsKey(networkId), () => getFeatureFlags(networkId, axios, apiUrlService))
  );

  await Promise.all(promises);
}
