import { isHttpError, type LeaseListParams } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import mapValues from "lodash/mapValues";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import { isProviderUnavailableError, retryOnServerError, SKIP_REPORTING_PROVIDER_UNAVAILABLE } from "@src/services/query-error-policy/query-error-policy";
import type { DeploymentDto, LeaseDto, RpcLease } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { omitAttestationSidecar } from "@src/utils/confidentialCompute";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { QueryKeys } from "./queryKeys";

/**
 * Closed deployments cannot gain leases. Infinity only after the fetched list itself
 * has no live leases, so a leftover Active-tab snapshot is still treated as stale.
 */
function closedDeploymentLeaseListStaleTime(state: string | undefined, leases: LeaseDto[] | null | undefined) {
  if (state !== "closed" || !leases || leases.some(isLeaseLive)) return 0;
  return Infinity;
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
    staleTime: query => closedDeploymentLeaseListStaleTime(deployment?.state, query.state.data),
    ...options
  });

  return {
    ...query,
    remove: () => queryClient.removeQueries({ queryKey })
  };
}

export type LeaseListState = NonNullable<LeaseListParams["state"]>;

type LeaseStateFilter = LeaseListState | readonly LeaseListState[];

async function getAllLeases(chainApiHttpClient: AxiosInstance, address: string, deployment?: any, state?: LeaseStateFilter) {
  if (!address) {
    return null;
  }

  const states = state == null ? [undefined] : Array.isArray(state) ? state : [state];
  const pages = await Promise.all(
    states.map(s => loadWithPagination<RpcLease[]>(ApiUrlService.leaseList("", address, deployment?.dseq, s), "leases", 1000, chainApiHttpClient))
  );

  return pages.flat().map(l => leaseToDto(l, deployment));
}

export function useAllLeases(address: string, options: { state?: LeaseStateFilter } & Omit<UseQueryOptions<LeaseDto[] | null>, "queryKey" | "queryFn"> = {}) {
  const { chainApiHttpClient } = useServices();
  const { state, ...queryOptions } = options;

  return useQuery({
    queryKey: QueryKeys.getAllLeasesKey(address, state),
    queryFn: () => getAllLeases(chainApiHttpClient, address, undefined, state),
    ...queryOptions
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
    queryKey: leaseStatusQueryKey(lease),
    queryFn: () =>
      fetchLeaseStatus({
        lease,
        provider,
        ensureToken: providerCredentials.ensureToken,
        request: (url, requestOptions) => fetchProviderUrl(url, requestOptions)
      }),
    ...options,
    retry: retryUnlessProviderIsUnavailable,
    meta: SKIP_REPORTING_PROVIDER_UNAVAILABLE,
    enabled: options.enabled !== false && !!provider?.hostUri && providerCredentials.details.usable,
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

export function useLeaseStatuses(
  items: { lease: LeaseDto; provider?: ApiProviderList | null }[],
  params: { dependencies?: typeof USE_LEASE_STATUS_DEPENDENCIES } & Omit<UseQueryOptions<LeaseStatusDto | null>, "queryKey" | "queryFn"> = {}
) {
  const { dependencies: d = USE_LEASE_STATUS_DEPENDENCIES, select: callerSelect, ...options } = params;
  const providerCredentials = d.useProviderCredentials();
  const { providerProxy } = useServices();

  return useQueries({
    queries: items.map(({ lease, provider }) => ({
      queryKey: leaseStatusQueryKey(lease),
      queryFn: () => {
        if (!provider) return null;
        return fetchLeaseStatus({
          lease,
          provider,
          ensureToken: providerCredentials.ensureToken,
          request: (url, requestOptions) => providerProxy.request(url, { ...requestOptions, providerIdentity: provider })
        });
      },
      ...options,
      retry: retryUnlessProviderIsUnavailable,
      meta: SKIP_REPORTING_PROVIDER_UNAVAILABLE,
      enabled: options.enabled !== false && !!provider?.hostUri && providerCredentials.details.usable,
      select: (data: LeaseStatusDto | null) => {
        const filtered = data ? omitAttestationSidecar(data) : data;
        return callerSelect ? callerSelect(filtered) : filtered;
      }
    }))
  });
}

function leaseStatusQueryKey(lease?: LeaseDto | null) {
  return QueryKeys.getLeaseStatusKey(lease?.dseq || "", lease?.gseq ?? 0, lease?.oseq ?? 0);
}

/**
 * An unreachable provider is not a Console fault and retrying cannot fix it, so these polls fail on the first
 * attempt instead of burning three and reporting each one.
 */
function retryUnlessProviderIsUnavailable(failureCount: number, error: unknown): boolean {
  return !isProviderUnavailableError(error) && retryOnServerError(failureCount, error);
}

function isLeaseStatusUnavailable(error: unknown): boolean {
  if (isHttpError(error) && (!error.response || error.response.status === 404 || error.code === "ERR_NETWORK")) {
    return true;
  }

  return error instanceof TypeError && /failed to fetch/i.test(error.message);
}

async function fetchLeaseStatus(input: {
  lease?: LeaseDto | null;
  provider?: ApiProviderList | null;
  ensureToken: () => Promise<string>;
  request: (url: string, options: { method: "GET"; credentials: { type: "jwt"; value: string } }) => Promise<{ data: LeaseStatusResponse | null }>;
}): Promise<LeaseStatusDto | null> {
  const { lease, provider, ensureToken, request } = input;
  if (!lease || !provider || !isLeaseLive(lease)) return null;

  const token = await ensureToken();
  const response = await request(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, {
    method: "GET",
    credentials: { type: "jwt", value: token }
  }).catch(error => {
    if (isLeaseStatusUnavailable(error)) {
      return { data: null };
    }
    throw error;
  });

  return response.data ? normalizeLeaseStatus(response.data) : null;
}

export interface ForwardedPort {
  host: string;
  externalPort: number;
  port: number;
  available: number;
}

export interface ServiceIp {
  IP: string;
  ExternalPort: number;
  Port: number;
  Protocol: string;
}

export interface LeaseStatusDto {
  forwarded_ports: Record<string, ForwardedPort[]>;
  ips: Record<string, ServiceIp[]>;
  services: Record<string, LeaseServiceStatus>;
}

/**
 * The provider's lease status as it arrives on the wire. Go marshals a nil slice or map as JSON
 * `null`, so a service exposing no ingress reports `uris: null`, a lease with no leased IPs reports
 * `ips: null`, and either map can carry a `null` value for an individual service.
 */
export interface LeaseStatusResponse {
  forwarded_ports: Record<string, ForwardedPort[] | null> | null;
  ips: Record<string, ServiceIp[] | null> | null;
  services: Record<string, LeaseServiceStatusResponse> | null;
}

export interface LeaseServiceStatusResponse extends Omit<LeaseServiceStatus, "uris"> {
  uris: string[] | null;
}

/**
 * Coerces the provider's nil-slice `null`s to empty arrays at the one point its JSON enters the app,
 * so every consumer can trust a LeaseStatusDto map and its arrays to be present. Runs in the queryFn
 * rather than in `select` so the coerced value is cached per fetch, letting React Query's structural
 * sharing keep it referentially stable across the status refetch interval.
 */
export function normalizeLeaseStatus(status: LeaseStatusResponse): LeaseStatusDto {
  return {
    forwarded_ports: mapValues(status.forwarded_ports ?? {}, ports => ports ?? []),
    ips: mapValues(status.ips ?? {}, ips => ips ?? []),
    services: mapValues(status.services ?? {}, service => ({ ...service, uris: service.uris ?? [] }))
  };
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
