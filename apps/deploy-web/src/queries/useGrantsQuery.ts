import type { DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useSettings } from "@src/context/SettingsProvider"; // eslint-disable-line import-x/no-cycle
import { useAuthZService } from "@src/hooks/useAuthZService";
import type { AllowanceType, PaginatedAllowanceType, PaginatedGrantType } from "@src/types/grant";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useGranterGrants(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedGrantType>, "queryKey" | "queryFn"> = {}
) {
  const { settings } = useSettings();
  const allowanceHttpService = useAuthZService();
  const offset = page * limit;

  options.enabled = options.enabled !== false && !!address && !!settings.apiEndpoint;

  return useQuery({
    queryKey: QueryKeys.getGranterGrants(address, page, offset),
    queryFn: () => allowanceHttpService.getPaginatedDepositDeploymentGrants({ granter: address, limit, offset }),
    ...options
  });
}

export function useGranteeGrants(address: string, options: Omit<UseQueryOptions<DepositDeploymentGrant[]>, "queryKey" | "queryFn"> = {}) {
  const allowanceHttpService = useAuthZService();
  const { settings } = useSettings();

  options.enabled = options.enabled !== false && !!address && !!settings.apiEndpoint;

  return useQuery({
    queryKey: QueryKeys.getGranteeGrants(address || "UNDEFINED"),
    queryFn: () => allowanceHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
    ...options
  });
}

export function useAllowancesIssued(
  address: string,
  page: number,
  limit: number,
  options: Omit<UseQueryOptions<PaginatedAllowanceType>, "queryKey" | "queryFn"> = {}
) {
  const { settings } = useSettings();
  const allowanceHttpService = useAuthZService();
  const offset = page * limit;

  options.enabled = options.enabled !== false && !!address && !!settings.apiEndpoint;

  return useQuery({
    queryKey: QueryKeys.getAllowancesIssued(address, page, offset),
    queryFn: () => allowanceHttpService.getPaginatedFeeAllowancesForGranter(address, limit, offset),
    ...options
  });
}

async function getAllowancesGranted(apiEndpoint: string, address: string) {
  return await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesGranted(apiEndpoint, address), "allowances", 1000);
}

export function useAllowancesGranted(address: string, options: Omit<UseQueryOptions<AllowanceType[]>, "queryKey" | "queryFn"> = {}) {
  const { settings } = useSettings();

  options.enabled = options.enabled !== false && !!address && !!settings.apiEndpoint;

  return useQuery({
    queryKey: address ? QueryKeys.getAllowancesGranted(address) : [],
    queryFn: () => getAllowancesGranted(settings.apiEndpoint, address),
    ...options
  });
}
