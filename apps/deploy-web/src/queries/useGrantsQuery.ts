import type { DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { AllowanceType, PaginatedAllowanceType, PaginatedGrantType } from "@src/types/grant";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useGranterGrants(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedGrantType>, "queryKey" | "queryFn"> = {}
) {
  const { authzHttpService } = useServices();
  const offset = page * limit;

  options.enabled = options.enabled !== false && !!address && !!authzHttpService.axios.defaults.baseURL;

  return useQuery({
    queryKey: QueryKeys.getGranterGrants(address, page, offset),
    queryFn: () => authzHttpService.getPaginatedDepositDeploymentGrants({ granter: address, limit, offset }),
    ...options
  });
}

export function useGranteeGrants(address: string, options: Omit<UseQueryOptions<DepositDeploymentGrant[]>, "queryKey" | "queryFn"> = {}) {
  const { authzHttpService } = useServices();

  options.enabled = options.enabled !== false && !!address && !!authzHttpService.axios.defaults.baseURL;

  return useQuery({
    queryKey: QueryKeys.getGranteeGrants(address || "UNDEFINED"),
    queryFn: () => authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
    ...options
  });
}

export function useAllowancesIssued(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedAllowanceType>, "queryKey" | "queryFn"> = {}
) {
  const { authzHttpService } = useServices();
  const offset = page * limit;

  options.enabled = options.enabled !== false && !!address && !!authzHttpService.axios.defaults.baseURL;

  return useQuery({
    queryKey: QueryKeys.getAllowancesIssued(address, page, offset),
    queryFn: () => authzHttpService.getPaginatedFeeAllowancesForGranter(address, limit, offset),
    ...options
  });
}

async function getAllowancesGranted(chainApiHttpClient: AxiosInstance, address: string) {
  return await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesGranted("", address), "allowances", 1000, chainApiHttpClient);
}

export function useAllowancesGranted(address: string, options: Omit<UseQueryOptions<AllowanceType[]>, "queryKey" | "queryFn"> = {}) {
  const { chainApiHttpClient } = useServices();

  options.enabled = options.enabled !== false && !!address && !!chainApiHttpClient.defaults.baseURL;

  return useQuery({
    queryKey: address ? QueryKeys.getAllowancesGranted(address) : [],
    queryFn: () => getAllowancesGranted(chainApiHttpClient, address),
    ...options
  });
}
