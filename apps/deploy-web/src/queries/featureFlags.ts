import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import networkStore from "@src/store/networkStore";
import { QueryKeys } from "./queryKeys";

const REFETCH_INTERVAL = 1000 * 60 * 5;
/** @deprecated use useFlag instead */
export function useFeatureFlags(options?: Omit<UseQueryOptions<Features>, "queryKey" | "queryFn">): UseQueryResult<Features> {
  const { publicConsoleApiHttpClient, apiUrlService } = useServices();
  const networkId = networkStore.useSelectedNetworkId();
  return useQuery({
    ...options,
    queryKey: QueryKeys.getFeatureFlagsKey(networkId),
    queryFn: () => getFeatureFlags(networkId, publicConsoleApiHttpClient, apiUrlService),
    refetchInterval: REFETCH_INTERVAL
  });
}

export interface Features {
  allowAnonymousUserTrial?: boolean;
}

export async function getFeatureFlags(networkId: NetworkId, consoleApiHttpClient: AxiosInstance, apiUrlService: ApiUrlService) {
  const response = await consoleApiHttpClient.get<{ data: Features }>("/v1/features", {
    baseURL: apiUrlService.getBaseApiUrlFor(networkId)
  });
  return response.data.data;
}
