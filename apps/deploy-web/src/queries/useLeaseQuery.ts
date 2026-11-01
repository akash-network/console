import type { paths } from "@akashnetwork/console-api-types";
import { isHttpError } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import groupBy from "lodash/groupBy";
import mapValues from "lodash/mapValues";
import uniq from "lodash/uniq";

import { useServices } from "@src/context/ServicesProvider";
import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { LEASE_STATUS_SCOPE, useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import {
  isProviderTokenRejection,
  isProviderUnavailableError,
  retryOnServerError,
  SKIP_REPORTING_PROVIDER_POLL_FAILURE
} from "@src/services/query-error-policy/query-error-policy";
import type { DeploymentDto, LeaseDto, RpcLease } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
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

type ListLeasesInput = NonNullable<paths["/v1/leases"]["get"]["parameters"]["query"]>;
type ListedLease = paths["/v1/leases"]["get"]["responses"][200]["content"]["application/json"]["data"][number];

function toLeaseDtos(leases: ListedLease[], deployment?: Pick<DeploymentDto, "groups">): LeaseDto[] {
  return leases.map(lease => leaseToDto({ lease: lease as RpcLease["lease"] }, deployment as Pick<DeploymentDto, "groups">));
}

export function useDeploymentLeaseList(
  address: string,
  deployment: (Pick<DeploymentDto, "dseq" | "groups"> & Partial<Pick<DeploymentDto, "state">>) | null | undefined,
  options: Omit<UseQueryOptions<LeaseDto[] | null>, "queryKey" | "queryFn"> = {}
) {
  const { api } = useServices();
  const queryClient = useQueryClient();

  const queryKey = QueryKeys.getLeasesKey(address, deployment?.dseq || "");
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!address || !deployment) return null;
      const { data } = await api.v1.listLeases.queryOptions({ dseq: deployment.dseq }).queryFn();
      return toLeaseDtos(data, deployment);
    },
    staleTime: query => closedDeploymentLeaseListStaleTime(deployment?.state, query.state.data),
    ...options
  });

  return {
    ...query,
    remove: () => queryClient.removeQueries({ queryKey })
  };
}

export type LeaseListState = NonNullable<ListLeasesInput["state"]>[number];

type LeaseStateFilter = LeaseListState | readonly LeaseListState[];

export function useAllLeases(address: string, options: { state?: LeaseStateFilter } & Omit<UseQueryOptions<LeaseDto[] | null>, "queryKey" | "queryFn"> = {}) {
  const { api } = useServices();
  const { state, ...queryOptions } = options;

  return useQuery({
    queryKey: QueryKeys.getAllLeasesKey(address, state),
    queryFn: async () => {
      if (!address) return null;
      const states = state === undefined ? undefined : typeof state === "string" ? [state] : [...state];
      const { data } = await api.v1.listLeases.queryOptions({ state: states }).queryFn();
      return toLeaseDtos(data);
    },
    ...queryOptions
  });
}

/**
 * Answers "has this address ever had a lease?" with a single limit-1 request, unlike
 * `useAllLeases` which reads the address's full lease history. Boot gates
 * (`RequireOnboarding`, `useOnboardingChrome`) only need this boolean, so they can
 * unblock without paying for the full paginated fetch. A `true` answer never goes stale
 * (a lease cannot un-exist); while `false`, default staleness keeps refetching on focus
 * so a first deploy made outside this tab is still picked up.
 */
export function useLeaseExistenceQuery(address: string, options: Omit<UseQueryOptions<boolean>, "queryKey" | "queryFn"> = {}) {
  const { api } = useServices();

  return useQuery({
    queryKey: QueryKeys.getLeaseExistenceKey(address),
    queryFn: async () => (await api.v1.listLeases.queryOptions({ limit: 1 }).queryFn()).data.length > 0,
    staleTime: query => (query.state.data ? Infinity : 0),
    ...options
  });
}

/**
 * Lease-status polls own their retry and error-reporting policy, so `retry` and `meta` are not caller-settable:
 * both hooks below set them unconditionally, and accepting them here would silently drop whatever a caller passed.
 */
type LeaseStatusQueryOptions = Omit<UseQueryOptions<LeaseStatusDto | null>, "queryKey" | "queryFn" | "retry" | "meta">;

export function useLeaseStatus(
  params: {
    provider?: ApiProviderList | null;
    lease?: LeaseDto | null;
    dependencies?: typeof USE_LEASE_STATUS_DEPENDENCIES;
  } & LeaseStatusQueryOptions = {}
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
    meta: SKIP_REPORTING_PROVIDER_POLL_FAILURE,
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
  params: { dependencies?: typeof USE_LEASE_STATUS_DEPENDENCIES } & LeaseStatusQueryOptions = {}
) {
  const { dependencies: d = USE_LEASE_STATUS_DEPENDENCIES, select: callerSelect, ...options } = params;
  const providerCredentials = d.useProviderCredentials();
  const { providerProxy } = useServices();
  const dseqsByProvider = liveDseqsByProvider(items);

  return useQueries({
    queries: items.map(({ lease, provider }) => ({
      queryKey: leaseStatusQueryKey(lease),
      queryFn: () => {
        if (!provider) return null;
        return fetchLeaseStatus({
          lease,
          provider,
          dseqs: dseqsByProvider[provider.owner],
          ensureToken: providerCredentials.ensureToken,
          request: (url, requestOptions) => providerProxy.request(url, { ...requestOptions, providerIdentity: provider })
        });
      },
      ...options,
      retry: retryUnlessProviderIsUnavailable,
      meta: SKIP_REPORTING_PROVIDER_POLL_FAILURE,
      enabled: options.enabled !== false && !!provider?.hostUri && providerCredentials.details.usable,
      select: (data: LeaseStatusDto | null) => {
        const filtered = data ? omitAttestationSidecar(data) : data;
        return callerSelect ? callerSelect(filtered) : filtered;
      }
    }))
  });
}

/** One status token per provider covers its deployments here, so one refused deployment refuses status for every one grouped with it. */
function liveDseqsByProvider(items: { lease: LeaseDto; provider?: ApiProviderList | null }[]): Record<string, string[]> {
  const liveItems = items.filter(({ lease, provider }) => !!provider && isLeaseLive(lease));

  return mapValues(
    groupBy(liveItems, ({ provider }) => provider?.owner),
    group => uniq(group.map(({ lease }) => lease.dseq))
  );
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

type LeaseStatusRequest = (
  url: string,
  options: { method: "GET"; credentials: { type: "jwt"; value: string } }
) => Promise<{ data: LeaseStatusResponse | null }>;

async function fetchLeaseStatus(input: {
  lease?: LeaseDto | null;
  provider?: ApiProviderList | null;
  dseqs?: readonly string[];
  ensureToken: UseProviderCredentialsResult["ensureToken"];
  request: LeaseStatusRequest;
}): Promise<LeaseStatusDto | null> {
  const { lease, provider, request } = input;
  if (!lease || !provider || !isLeaseLive(lease)) return null;

  const access = { provider: provider.owner, dseqs: input.dseqs ?? [lease.dseq], scope: LEASE_STATUS_SCOPE };
  const ensureToken = (options?: { force?: boolean }) => input.ensureToken({ ...options, access });
  const response = await requestLeaseStatus(`/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`, { ensureToken, request }).catch(error => {
    if (isLeaseStatusUnavailable(error)) {
      return { data: null };
    }
    throw error;
  });

  return response.data ? normalizeLeaseStatus(response.data) : null;
}

/**
 * The proxy validates the provider JWT before it dials, so a token this client still believes in can be rejected
 * on a clock the proxy disagrees with. That rejection earns one forced refresh and a single retry.
 */
async function requestLeaseStatus(
  url: string,
  input: { ensureToken: (options?: { force?: boolean }) => Promise<string>; request: LeaseStatusRequest }
): Promise<{ data: LeaseStatusResponse | null }> {
  const send = async (token: string) => input.request(url, { method: "GET", credentials: { type: "jwt", value: token } });

  try {
    return await send(await input.ensureToken());
  } catch (error) {
    if (!isProviderTokenRejection(error)) throw error;
    return send(await input.ensureToken({ force: true }));
  }
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
