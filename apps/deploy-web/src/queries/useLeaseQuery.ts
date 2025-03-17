import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import { AxiosStatic } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import { DeploymentDto, LeaseDto, RpcLease } from "@src/types/deployment";
import { ApiProviderList } from "@src/types/provider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { useCertificate } from "../context/CertificateProvider";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

// Leases
async function getDeploymentLeases(apiEndpoint: string, address: string, deployment: Pick<DeploymentDto, "dseq" | "groups">) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination<RpcLease[]>(ApiUrlService.leaseList(apiEndpoint, address, deployment?.dseq), "leases", 1000);

  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useDeploymentLeaseList(
  address: string,
  deployment: Pick<DeploymentDto, "dseq" | "groups"> | null | undefined,
  options: UseQueryOptions<LeaseDto[] | null>
) {
  const { settings } = useSettings();

  return useQuery(
    QueryKeys.getLeasesKey(address, deployment?.dseq || "") as QueryKey,
    async () => {
      if (!deployment) return null;
      return getDeploymentLeases(settings.apiEndpoint, address, deployment);
    },
    options
  );
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
  return useQuery(QueryKeys.getAllLeasesKey(address), () => getAllLeases(settings.apiEndpoint, address, undefined, axios), options);
}

export function useLeaseStatus(provider: ApiProviderList | undefined, lease: LeaseDto | undefined, options: UseQueryOptions<LeaseStatusDto | null>) {
  const { localCert } = useCertificate();
  const fetchProviderUrl = useScopedFetchProviderUrl(provider);

  return useQuery(
    QueryKeys.getLeaseStatusKey(lease?.dseq || "", lease?.gseq || NaN, lease?.oseq || NaN) as QueryKey,
    async () => {
      if (!lease) return null;

      const response = await fetchProviderUrl<LeaseStatusDto>(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, {
        method: "GET",
        certPem: localCert?.certPem,
        keyPem: localCert?.keyPem
      });
      return response.data;
    },
    options
  );
}

export interface LeaseStatusDto {
  forwarded_ports: any;
  ips: any;
  services: Record<string, LeaseServiceStatus>;
}

export interface LeaseServiceStatus {
  name: string;
  available: number;
  total: number;
  uris: string[];
  observed_generation: number;
  replicas: number;
  updated_replicas: number;
  ready_replicas: number;
  available_replicas: number;
}
