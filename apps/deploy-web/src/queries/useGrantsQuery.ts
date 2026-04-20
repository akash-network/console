import type { DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import { getAllItems } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { AllowanceType, PaginatedAllowanceType, PaginatedGrantType } from "@src/types/grant";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useGranterGrants(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedGrantType>, "queryKey" | "queryFn"> = {}
) {
  const { authzHttpService, chainApiHttpClient } = useServices();
  const offset = page * limit;

  return useQuery({
    queryKey: QueryKeys.getGranterGrants(address, page, offset),
    queryFn: () => authzHttpService.getPaginatedDepositDeploymentGrants({ granter: address, limit, offset }),
    ...options,
    enabled: options.enabled !== false && !!address && !chainApiHttpClient.isFallbackEnabled
  });
}

export function useGranteeGrants(address: string, options: Omit<UseQueryOptions<DepositDeploymentGrant[]>, "queryKey" | "queryFn"> = {}) {
  const { authzHttpService, chainApiHttpClient } = useServices();

  return useQuery({
    queryKey: QueryKeys.getGranteeGrants(address || "UNDEFINED"),
    queryFn: () => authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
    ...options,
    enabled: options.enabled !== false && !!address && !chainApiHttpClient.isFallbackEnabled
  });
}

export function useAllowancesIssued(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedAllowanceType>, "queryKey" | "queryFn"> = {}
) {
  const { authzHttpService, chainApiHttpClient } = useServices();
  const offset = page * limit;

  return useQuery({
    queryKey: QueryKeys.getAllowancesIssued(address, page, offset),
    queryFn: () => authzHttpService.getPaginatedFeeAllowancesForGranter(address, limit, offset),
    ...options,
    enabled: options.enabled !== false && !!address && !chainApiHttpClient.isFallbackEnabled
  });
}

async function getAllowancesGranted(chainApiHttpClient: AxiosInstance, address: string) {
  return getAllItems<AllowanceType>(async params => {
    const response = await chainApiHttpClient.get(ApiUrlService.allowancesGranted("", address), {
      params: { "pagination.limit": 1000, ...params }
    });
    return { items: response.data.allowances, pagination: response.data.pagination };
  });
}

export function useAllowancesGranted(address: string, options: Omit<UseQueryOptions<AllowanceType[]>, "queryKey" | "queryFn"> = {}) {
  const { chainApiHttpClient } = useServices();

  return useQuery({
    queryKey: address ? QueryKeys.getAllowancesGranted(address) : [],
    queryFn: () => getAllowancesGranted(chainApiHttpClient, address),
    ...options,
    enabled: options.enabled !== false && !!address && !chainApiHttpClient.isFallbackEnabled
  });
}
