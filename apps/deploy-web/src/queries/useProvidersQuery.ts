import { QueryKey, useQuery, UseQueryOptions, UseQueryResult } from "react-query";
import axios from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import { ApiProviderDetail, ApiProviderList, ApiProviderRegion, Auditor, ProviderStatus, ProviderStatusDto, ProviderVersion } from "@src/types/provider";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { ApiUrlService } from "@src/utils/apiUtils";
import { getNetworkCapacityDto, providerStatusToDto } from "@src/utils/providerUtils";
import { QueryKeys } from "./queryKeys";

export function useProviderDetail(owner: string, options: UseQueryOptions<ApiProviderDetail | null>): UseQueryResult<ApiProviderDetail | null> {
  const services = useServices();
  return useQuery(
    QueryKeys.getProviderDetailKey(owner) as QueryKey,
    async () => {
      if (!owner) return null;
      const response = await services.axios.get(ApiUrlService.providerDetail(owner));
      return response.data;
    },
    options
  );
}

export function useProviderStatus(
  provider: ApiProviderList | undefined | null,
  options: UseQueryOptions<ProviderStatusDto> = {}
): UseQueryResult<ProviderStatusDto> {
  const fetchProviderUrl = useScopedFetchProviderUrl(provider);
  return useQuery(
    QueryKeys.getProviderStatusKey(provider?.hostUri || "") as QueryKey,
    async () => {
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
    options
  );
}

async function getNetworkCapacity() {
  const response = await axios.get(ApiUrlService.networkCapacity());

  return getNetworkCapacityDto(response.data);
}

export function useNetworkCapacity(options = {}) {
  return useQuery(QueryKeys.getNetworkCapacity(), () => getNetworkCapacity(), options);
}

async function getAuditors() {
  const response = await axios.get(ApiUrlService.auditors());

  return response.data;
}

export function useAuditors(options = {}) {
  return useQuery<Array<Auditor>>(QueryKeys.getAuditorsKey(), () => getAuditors(), {
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
  return useQuery(QueryKeys.getProviderActiveLeasesGraph(providerAddress), () => getProviderActiveLeasesGraph(providerAddress), options);
}

async function getProviderAttributesSchema() {
  const response = await axios.get(ApiUrlService.providerAttributesSchema());

  return response.data as ProviderAttributesSchema;
}

export function useProviderAttributesSchema(options = {}) {
  return useQuery(QueryKeys.getProviderAttributesSchema(), () => getProviderAttributesSchema(), {
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
  return useQuery(QueryKeys.getProviderListKey(), () => getProviderList(), options);
}

async function getProviderRegions(): Promise<Array<ApiProviderRegion>> {
  const response = await axios.get(ApiUrlService.providerRegions());

  return response.data;
}

export function useProviderRegions(options = {}) {
  return useQuery(QueryKeys.getProviderRegionsKey(), () => getProviderRegions(), options);
}
