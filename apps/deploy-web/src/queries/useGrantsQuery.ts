import { QueryObserverResult, useQuery } from "react-query";

import { useSettings } from "@src/context/SettingsProvider";
import { useAuthZService } from "@src/hooks/useAuthZService";
import { AllowanceType, GrantType } from "@src/types/grant";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getGranterGrants(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  const grants = await loadWithPagination<GrantType[]>(ApiUrlService.granterGrants(apiEndpoint, address), "grants", 1000);
  return grants.filter(
    x =>
      x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );
}

export function useGranterGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranterGrants(address), () => getGranterGrants(settings.apiEndpoint, address), options);
}

export function useGranteeGrants(address?: string, options: { enabled?: boolean; refetchInterval?: number } = { enabled: true }) {
  const allowanceHttpService = useAuthZService();
  const { settings } = useSettings();

  // TODO: ensure app is not loaded till settings are fetched
  //   Issue: https://github.com/akash-network/console/issues/600
  options.enabled = !!address && !!settings.apiEndpoint;

  return useQuery(
    QueryKeys.getGranteeGrants(address || "UNDEFINED"),
    () => (address ? allowanceHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }) : []),
    options
  );
}

async function getAllowancesIssued(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  return await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesIssued(apiEndpoint, address), "allowances", 1000);
}

export function useAllowancesIssued(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getAllowancesIssued(address), () => getAllowancesIssued(settings.apiEndpoint, address), options);
}

async function getAllowancesGranted(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  return await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesGranted(apiEndpoint, address), "allowances", 1000);
}

export function useAllowancesGranted(address?: string, options = {}): QueryObserverResult<AllowanceType[]> {
  const { settings } = useSettings();

  return useQuery(address ? QueryKeys.getAllowancesGranted(address) : "", () => (address ? getAllowancesGranted(settings.apiEndpoint, address) : undefined), {
    ...options,
    enabled: !!address
  });
}
