import { useQuery, UseQueryResult } from "@tanstack/react-query";
import axios from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import { ApiProviderDetail, ApiProviderList, ApiProviderRegion, Auditor, ProviderStatus, ProviderVersion } from "@src/types/provider";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { ApiUrlService } from "@src/utils/apiUtils";
import { getNetworkCapacityDto, providerStatusToDto } from "@src/utils/providerUtils";
import { QueryKeys } from "./queryKeys";

export function useProviderDetail(owner: string, options): UseQueryResult<ApiProviderDetail | null> {
  const services = useServices();
  return useQuery({
    queryKey: QueryKeys.getProviderDetailKey(owner),
    queryFn: async () => {
      if (!owner) return null;
      const response = await services.axios.get(ApiUrlService.providerDetail(owner));
      return response.data;
    },
    ...options
  });
}

export function useProviderStatus(provider: ApiProviderList | undefined | null, options = {}) {
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

async function getNetworkCapacity() {
  const response = await axios.get(ApiUrlService.networkCapacity());

  return getNetworkCapacityDto(response.data);
}

export function useNetworkCapacity(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getNetworkCapacity(),
    queryFn: () => getNetworkCapacity(),
    ...options
  });
}

async function getAuditors() {
  const response = await axios.get(ApiUrlService.auditors());

  return response.data;
}

export function useAuditors(options = {}) {
  return useQuery<Array<Auditor>>({
    queryKey: QueryKeys.getAuditorsKey(),
    queryFn: () => getAuditors(),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

async function getProviderActiveLeasesGraph(providerAddress: string) {
  const response = await axios.get(ApiUrlService.providerActiveLeasesGraph(providerAddress));

  return response.data;
}

export function useProviderActiveLeasesGraph(providerAddress: string, options = {}) {
  return useQuery({
    queryKey: QueryKeys.getProviderActiveLeasesGraph(providerAddress),
    queryFn: () => getProviderActiveLeasesGraph(providerAddress),
    ...options
  });
}

async function getProviderAttributesSchema() {
  const response = await axios.get(ApiUrlService.providerAttributesSchema());

  return response.data as ProviderAttributesSchema;
}

export function useProviderAttributesSchema(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getProviderAttributesSchema(),
    queryFn: () => getProviderAttributesSchema(),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

async function getProviderList(): Promise<Array<ApiProviderList>> {
  const response = await axios.get(ApiUrlService.providerList());

  return response.data;
}

export function useProviderList(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getProviderListKey(),
    queryFn: () => getProviderList(),
    ...options
  });
}

async function getProviderRegions(): Promise<Array<ApiProviderRegion>> {
  const response = await axios.get(ApiUrlService.providerRegions());

  return response.data;
}

export function useProviderRegions(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getProviderRegionsKey(),
    queryFn: () => getProviderRegions(),
    ...options
  });
}
