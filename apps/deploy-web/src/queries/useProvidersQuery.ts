import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { ApiProviderDetail, ApiProviderList, ApiProviderRegion, Auditor } from "@src/types/provider";
import { ProviderAttributesSchema } from "@src/types/providerAttributes";
import { ApiUrlService } from "@src/utils/apiUtils";
import { PROVIDER_PROXY_URL } from "@src/utils/constants";
import { getNetworkCapacityDto, providerStatusToDto } from "@src/utils/providerUtils";
import { QueryKeys } from "./queryKeys";

async function getProviderDetail(owner: string): Promise<ApiProviderDetail | null> {
  if (!owner) return null;

  const response = await axios.get(ApiUrlService.providerDetail(owner));

  return response.data;
}

export function useProviderDetail(owner: string, options) {
  return useQuery({
    queryKey: QueryKeys.getProviderDetailKey(owner),
    queryFn: () => getProviderDetail(owner),
    ...options,
  });
}

async function getProviderStatus(providerUri: string) {
  if (!providerUri) return null;

  try {
    const statusResponse = await axios.post(PROVIDER_PROXY_URL, { url: `${providerUri}/status`, method: "GET" });
    const versionResponse = await axios.post(PROVIDER_PROXY_URL, { url: `${providerUri}/version`, method: "GET" });
    return providerStatusToDto(statusResponse.data, versionResponse?.data || {});
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function useProviderStatus(providerUri: string, options = {}) {
  return useQuery({
    queryKey: QueryKeys.getProviderStatusKey(providerUri),
    queryFn: () => getProviderStatus(providerUri),
    ...options,
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
    ...options,
  });
}

async function getAuditors() {
  const response = await axios.get(ApiUrlService.auditors());

  return response.data;
}

export function useAuditors(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getAuditorsKey(),
    queryFn: () => getAuditors(),
    ...options,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
    ...options,
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
    refetchOnReconnect: false,
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
    ...options,
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
    ...options,
  });
}