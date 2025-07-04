import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import type { DeploymentDto, LeaseDto, RpcLease } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { useCertificate } from "../context/CertificateProvider";
import { QueryKeys } from "./queryKeys";

// Leases
async function getDeploymentLeases(chainApiHttpClient: AxiosInstance, address: string, deployment: Pick<DeploymentDto, "dseq" | "groups">) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination<RpcLease[]>(ApiUrlService.leaseList("", address, deployment?.dseq), "leases", 1000, chainApiHttpClient);
  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useDeploymentLeaseList(
  address: string,
  deployment: Pick<DeploymentDto, "dseq" | "groups"> | null | undefined,
  options: Omit<UseQueryOptions<LeaseDto[] | null>, "queryKey" | "queryFn"> = {}
) {
  const { chainApiHttpClient } = useServices();
  const queryClient = useQueryClient();

  const queryKey = QueryKeys.getLeasesKey(address, deployment?.dseq || "");
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!deployment) return null;
      return getDeploymentLeases(chainApiHttpClient, address, deployment);
    },
    ...options
  });

  return {
    ...query,
    remove: () => queryClient.removeQueries({ queryKey })
  };
}

async function getAllLeases(chainApiHttpClient: AxiosInstance, address: string, deployment?: any) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination<RpcLease[]>(ApiUrlService.leaseList("", address, deployment?.dseq), "leases", 1000, chainApiHttpClient);
  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useAllLeases(address: string, options = {}) {
  const { chainApiHttpClient } = useServices();

  return useQuery({
    queryKey: QueryKeys.getAllLeasesKey(address),
    queryFn: () => getAllLeases(chainApiHttpClient, address),
    ...options
  });
}

export function useLeaseStatus(
  provider: ApiProviderList | undefined,
  lease: LeaseDto | undefined,
  options: Omit<UseQueryOptions<LeaseStatusDto | null>, "queryKey" | "queryFn"> = {}
) {
  const { localCert } = useCertificate();
  const fetchProviderUrl = useScopedFetchProviderUrl(provider);

  return useQuery({
    queryKey: QueryKeys.getLeaseStatusKey(lease?.dseq || "", lease?.gseq || NaN, lease?.oseq || NaN),
    queryFn: async () => {
      if (!lease) return null;

      const response = await fetchProviderUrl<LeaseStatusDto>(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, {
        method: "GET",
        certPem: localCert?.certPem,
        keyPem: localCert?.keyPem
      });
      return response.data;
    },
    ...options
  });
}

export interface LeaseStatusDto {
  forwarded_ports: Record<
    string,
    {
      host: string;
      externalPort: number;
      port: number;
      available: number;
    }[]
  >;
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
