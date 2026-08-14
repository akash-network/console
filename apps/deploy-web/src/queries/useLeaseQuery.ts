import { isHttpError } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import type { DeploymentDto, LeaseDto, RpcLease } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { omitAttestationSidecar } from "@src/utils/confidentialCompute";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { isLeaseLive } from "@src/utils/reclamationUtils";
import { QueryKeys } from "./queryKeys";

/** Closed deployments cannot gain or change leases, so a successful list never needs refetching. */
function closedDeploymentLeaseListStaleTime(state: string | undefined) {
  return state === "closed" ? Infinity : undefined;
}

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
  deployment: (Pick<DeploymentDto, "dseq" | "groups"> & Partial<Pick<DeploymentDto, "state">>) | null | undefined,
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
    staleTime: closedDeploymentLeaseListStaleTime(deployment?.state),
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

/**
 * Answers "has this address ever had a lease?" with the SDK's single limit-1 request, unlike
 * `useAllLeases` which pages through the address's full lease history. Boot gates
 * (`RequireOnboarding`, `useOnboardingChrome`) only need this boolean, so they can
 * unblock without paying for the full paginated fetch. A `true` answer never goes stale
 * (a lease cannot un-exist); while `false`, default staleness keeps refetching on focus
 * so a first deploy made outside this tab is still picked up.
 */
export function useLeaseExistenceQuery(address: string, options: Omit<UseQueryOptions<boolean>, "queryKey" | "queryFn"> = {}) {
  const { leaseHttpService } = useServices();

  return useQuery({
    queryKey: QueryKeys.getLeaseExistenceKey(address),
    queryFn: () => leaseHttpService.hasLeases(address),
    staleTime: query => (query.state.data ? Infinity : 0),
    ...options
  });
}

export function useLeaseStatus(
  params: {
    provider?: ApiProviderList | null;
    lease?: LeaseDto | null;
    dependencies?: typeof USE_LEASE_STATUS_DEPENDENCIES;
  } & Omit<UseQueryOptions<LeaseStatusDto | null>, "queryKey" | "queryFn"> = {}
) {
  const { provider, lease, dependencies: d = USE_LEASE_STATUS_DEPENDENCIES, select: callerSelect, ...options } = params;
  const providerCredentials = d.useProviderCredentials();
  const fetchProviderUrl = d.useScopedFetchProviderUrl(provider);

  return useQuery({
    queryKey: QueryKeys.getLeaseStatusKey(lease?.dseq || "", lease?.gseq || NaN, lease?.oseq || NaN),
    queryFn: async () => {
      if (!lease || !isLeaseLive(lease) || !providerCredentials.details.usable) return null;

      const token = await providerCredentials.ensureToken();
      const response = await fetchProviderUrl<LeaseStatusDto>(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, {
        method: "GET",
        credentials: { type: "jwt", value: token }
      }).catch(error => {
        if (isHttpError(error) && error.response?.status === 404) {
          return { data: null };
        }
        throw error;
      });

      return response.data;
    },
    ...options,
    enabled: options.enabled !== false && providerCredentials.details.usable,
    // Defensive: the attestation sidecar is a pod container under the current provider design and
    // never appears as a lease-status service, so this is a passthrough today. It keeps the sidecar
    // out of every consumer (status list, logs/shell selectors) at one chokepoint if that changes.
    select: data => {
      const filtered = data ? omitAttestationSidecar(data) : data;
      return callerSelect ? callerSelect(filtered) : filtered;
    }
  });
}
export const USE_LEASE_STATUS_DEPENDENCIES = {
  useScopedFetchProviderUrl,
  useProviderCredentials
};

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
