import type { QueryKey, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import type { ApiProviderDetail, ApiProviderList, ApiProviderRegion, Auditor, ProviderStatus, ProviderStatusDto, ProviderVersion } from "@src/types/provider";
import type { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { ApiUrlService } from "@src/utils/apiUtils";
import { getNetworkCapacityDto, providerStatusToDto } from "@src/utils/providerUtils";
import { QueryKeys } from "./queryKeys";

export function useProviderDetail(
  owner: string,
  options: Omit<UseQueryOptions<ApiProviderDetail | null>, "queryKey" | "queryFn">
): UseQueryResult<ApiProviderDetail | null> {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderDetailKey(owner) as QueryKey,
    queryFn: async () => {
      if (!owner) return null;
      const response = await publicConsoleApiHttpClient.get(ApiUrlService.providerDetail(owner));
      return response.data;
    },
    ...options
  });
}

export function useProviderStatus(
  provider: ApiProviderList | undefined | null,
  options: Omit<UseQueryOptions<ProviderStatusDto>, "queryKey" | "queryFn"> = {}
): UseQueryResult<ProviderStatusDto> {
  const fetchProviderUrl = useScopedFetchProviderUrl(provider);
  return useQuery({
    queryKey: QueryKeys.getProviderStatusKey(provider?.hostUri || ""),
    queryFn: async () => {
      try {
        const [statusResponse, versionResponse] = await Promise.all([
          fetchProviderUrl<ProviderStatus>("/status"),
          fetchProviderUrl<ProviderVersion>("/version")
        ]);
        return providerStatusToDto(statusResponse.data, versionResponse.data || {});
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    ...options
  });
}

export function useNetworkCapacity(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getNetworkCapacity(),
    queryFn: () => publicConsoleApiHttpClient.get(ApiUrlService.networkCapacity()).then(response => getNetworkCapacityDto(response.data)),
    ...options
  });
}

export function useAuditors(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery<Array<Auditor>>({
    queryKey: QueryKeys.getAuditorsKey(),
    queryFn: () => publicConsoleApiHttpClient.get(ApiUrlService.auditors()).then(response => response.data),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

export function useProviderActiveLeasesGraph(providerAddress: string, options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderActiveLeasesGraph(providerAddress),
    queryFn: () => publicConsoleApiHttpClient.get(ApiUrlService.providerActiveLeasesGraph(providerAddress)).then(response => response.data),
    ...options
  });
}

export function useProviderAttributesSchema(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderAttributesSchema(),
    queryFn: () => publicConsoleApiHttpClient.get<ProviderAttributesSchema>(ApiUrlService.providerAttributesSchema()).then(response => response.data),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

export function useProviderList(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderListKey(),
    queryFn: () => publicConsoleApiHttpClient.get<ApiProviderList[]>(ApiUrlService.providerList()).then(response => response.data),
    ...options
  });
}

export function useProviderRegions(options = {}) {
  const { publicConsoleApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderRegionsKey(),
    queryFn: () => publicConsoleApiHttpClient.get<ApiProviderRegion[]>(ApiUrlService.providerRegions()).then(response => response.data),
    ...options
  });
}
