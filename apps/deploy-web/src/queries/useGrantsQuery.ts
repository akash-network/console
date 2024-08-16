import { QueryObserverResult, useQuery } from "react-query";
import axios from "axios";

import { useSettings } from "@src/context/SettingsProvider";
import { AllowanceType, GrantType } from "@src/types/grant";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getGranterGrants(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return [];

  const response = await axios.get(ApiUrlService.granterGrants(apiEndpoint, address));
  const filteredGrants = response.data.grants.filter(
    x =>
      x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants as GrantType[];
}

export function useGranterGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranterGrants(address), () => getGranterGrants(settings.apiEndpoint, address), options);
}

async function getGranteeGrants(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return [];

  const response = await axios.get(ApiUrlService.granteeGrants(apiEndpoint, address));
  const filteredGrants = response.data.grants.filter(
    x =>
      // TODO: this is not working
      // Only the v1beta3 authorization are working
      // x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants as GrantType[];
}

export function useGranteeGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranteeGrants(address), () => getGranteeGrants(settings.apiEndpoint, address), options);
}

async function getAllowancesIssued(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return [];

  const response = await axios.get(ApiUrlService.allowancesIssued(apiEndpoint, address));

  return response.data.allowances as AllowanceType[];
}

export function useAllowancesIssued(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getAllowancesIssued(address), () => getAllowancesIssued(settings.apiEndpoint, address), options);
}

async function getAllowancesGranted(apiEndpoint: string, address: string) {
  if (!address || !apiEndpoint) return [];

  const response = await axios.get(ApiUrlService.allowancesGranted(apiEndpoint, address));

  return response.data.allowances as AllowanceType[];
}

export function useAllowancesGranted(address?: string, options = {}): QueryObserverResult<AllowanceType[]> {
  const { settings } = useSettings();

  return useQuery(address ? QueryKeys.getAllowancesGranted(address) : "", () => (address ? getAllowancesGranted(settings.apiEndpoint, address) : undefined), {
    ...options,
    enabled: !!address
  });
}
