import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios, { AxiosResponse } from "axios";
import { useSettings } from "../context/SettingsProvider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { getNetworkCapacityDto, providerStatusToDto } from "@src/utils/providerUtils";
import { PROVIDER_PROXY_URL } from "@src/utils/constants";
import { RpcProvider } from "@src/types/provider";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";

async function getProviderDetail(apiEndpoint: string, owner: string): Promise<RpcProvider> {
  if (!owner) return {} as RpcProvider;

  const response = await axios.get(ApiUrlService.providerDetail(apiEndpoint, owner));

  return response.data;
}

export function useProviderDetail(owner: string, options) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getProviderDetailKey(owner), () => getProviderDetail(settings.apiEndpoint, owner), options);
}

async function getProviders(apiEndpoint: string): Promise<Array<RpcProvider>> {
  if (apiEndpoint) {
    const providers = await loadWithPagination(ApiUrlService.providers(apiEndpoint), "providers", 1000);

    return providers;
  } else {
    return null;
  }
}

export function useProviders(options = {}) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getProvidersKey(), () => getProviders(settings.apiEndpoint), {
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
}

async function getDataNodeProviders() {
  const response = await axios.get(ApiUrlService.apiProviders());
  return response.data;
}

export function useDataNodeProviders(options) {
  return useQuery(QueryKeys.getDataNodeProvidersKey(), () => getDataNodeProviders(), {
    ...options,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false
  });
}

async function getProviderStatus(providerUri: string) {
  const statusResponse = await axios.post(PROVIDER_PROXY_URL, { url: `${providerUri}/status`, method: "GET" });
  let versionResponse: AxiosResponse<any, any>;

  try {
    versionResponse = await axios.post(PROVIDER_PROXY_URL, { url: `${providerUri}/version`, method: "GET" });
  } catch (error) {
    console.log(error);
  }

  const result = providerStatusToDto(statusResponse.data, versionResponse?.data || {});

  return result;
}

export function useProviderStatus(providerUri: string, options = {}) {
  return useQuery(QueryKeys.getProviderStatusKey(providerUri), () => getProviderStatus(providerUri), options);
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
  return useQuery(QueryKeys.getAuditorsKey(), () => getAuditors(), {
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
