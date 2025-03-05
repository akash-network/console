import { useQuery } from "@tanstack/react-query";
import { AxiosStatic } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import { LeaseDto, RpcLease } from "@src/types/deployment";
import { ApiProviderList, LeaseStatus } from "@src/types/provider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { useCertificate } from "../context/CertificateProvider";
import { useSettings } from "../context/SettingsProvider";
import { queryClient } from "./queryClient";
import { QueryKeys } from "./queryKeys";

// Leases
async function getDeploymentLeases(apiEndpoint: string, address: string, deployment) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination<RpcLease[]>(ApiUrlService.leaseList(apiEndpoint, address, deployment?.dseq), "leases", 1000);

  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useDeploymentLeaseList(address: string, deployment, options) {
  const { settings } = useSettings();
  const queryKey = QueryKeys.getLeasesKey(address, deployment?.dseq);

  return {
    remove: () => {
      queryClient.removeQueries({ queryKey });
    },
    ...useQuery<LeaseDto[]>({
      queryKey,
      queryFn: () => getDeploymentLeases(settings.apiEndpoint, address, deployment),
      ...options
    })
  };
}

async function getAllLeases(apiEndpoint: string, address: string, deployment?: any, httpClient?: AxiosStatic) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination<RpcLease[]>(ApiUrlService.leaseList(apiEndpoint, address, deployment?.dseq), "leases", 1000, httpClient);

  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useAllLeases(address: string, options = {}) {
  const { settings } = useSettings();
  const { axios } = useServices();
  return useQuery({
    queryKey: QueryKeys.getAllLeasesKey(address),
    queryFn: () => getAllLeases(settings.apiEndpoint, address, undefined, axios),
    ...options
  });
}

export function useLeaseStatus(provider: ApiProviderList | undefined, lease: LeaseDto | undefined, options) {
  const { localCert } = useCertificate();
  const fetchProviderUrl = useScopedFetchProviderUrl(provider);

  return useQuery<LeaseStatus, Error>({
    queryKey: QueryKeys.getLeaseStatusKey(lease?.dseq || "", lease?.gseq || NaN, lease?.oseq || NaN),
    queryFn: async () => {
      if (!lease) return null;

      const response = await fetchProviderUrl<LeaseStatus>(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, {
        method: "GET",
        certPem: localCert?.certPem,
        keyPem: localCert?.keyPem
      });
      return response.data;
    },
    ...options
  });
}
