import { QueryObserverResult, useQuery } from "react-query";

import { useSettings } from "@src/context/SettingsProvider";
import { AllowanceType, GrantType } from "@src/types/grant";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getGranterGrants(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  const grants = await loadWithPagination<GrantType[]>(ApiUrlService.granterGrants(apiEndpoint, address), "grants", 1000);
  const filteredGrants = grants.filter(
    x =>
      x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants;
}

export function useGranterGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranterGrants(address), () => getGranterGrants(settings.apiEndpoint, address), options);
}

async function getGranteeGrants(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  const grants = await loadWithPagination<GrantType[]>(ApiUrlService.granteeGrants(apiEndpoint, address), "grants", 1000);
  const filteredGrants = grants.filter(
    x =>
      // TODO: this is not working
      // Only the v1beta3 authorization are working
      // x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants;
}

export function useGranteeGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranteeGrants(address), () => getGranteeGrants(settings.apiEndpoint, address), options);
}

async function getAllowancesIssued(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  const allowances = await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesIssued(apiEndpoint, address), "allowances", 1000);

  return allowances;
}

export function useAllowancesIssued(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getAllowancesIssued(address), () => getAllowancesIssued(settings.apiEndpoint, address), options);
}

async function getAllowancesGranted(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return undefined;

  const allowances = await loadWithPagination<AllowanceType[]>(ApiUrlService.allowancesGranted(apiEndpoint, address), "allowances", 1000);

  return allowances;
}

export function useAllowancesGranted(address?: string, options = {}): QueryObserverResult<AllowanceType[]> {
  const { settings } = useSettings();

  return useQuery(address ? QueryKeys.getAllowancesGranted(address) : "", () => (address ? getAllowancesGranted(settings.apiEndpoint, address) : undefined), {
    ...options,
    enabled: !!address
  });
}
