"use client";
import { useEffect, useMemo, useState } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentLeaseList, useLeaseStatuses } from "@src/queries/useLeaseQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { collectVisitEndpoints } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";

export const DEPENDENCIES = {
  useWallet,
  useDeploymentLeaseList,
  useLeaseStatuses
};

export type UnreachableReason = "not-running" | "provider-unreachable" | "no-public-endpoint";

export interface DeploymentReachability {
  leases: LeaseDto[] | null | undefined;
  isLoadingLeases: boolean;
  endpoints: VisitEndpoint[];
  isLoadingEndpoints: boolean;
  unreachableReason: UnreachableReason | null;
}

/**
 * A lease status query stays pending forever when its provider is missing from the provider list or provider
 * credentials never become usable, so the card stops waiting on it and says so instead of spinning.
 */
const ENDPOINT_WAIT_MS = 15_000;

/**
 * Everything a deployment card needs to answer "where do I reach this": its leases, the endpoints its live
 * leases expose, and — when there are none — which of the three reasons applies.
 */
export function useDeploymentReachability(params: {
  deployment: Pick<DeploymentDto, "dseq" | "groups" | "state">;
  providers: ApiProviderList[] | undefined;
  dependencies?: typeof DEPENDENCIES;
}): DeploymentReachability {
  const { deployment, providers, dependencies: d = DEPENDENCIES } = params;
  const { address } = d.useWallet();
  const { data: leases, isLoading: isLoadingLeases } = d.useDeploymentLeaseList(address, deployment, { enabled: !!address });

  const liveLeaseItems = useMemo(
    () =>
      (leases ?? []).filter(isLeaseLive).map(lease => ({
        lease,
        provider: providers?.find(provider => provider.owner === lease.provider)
      })),
    [leases, providers]
  );

  const statuses = d.useLeaseStatuses(liveLeaseItems, { refetchInterval: 30_000 });
  const endpoints = useMemo(() => statuses.flatMap(status => collectVisitEndpoints(status.data)), [statuses]);

  const hasWaitExpired = useHasWaitExpired(ENDPOINT_WAIT_MS);
  const isLoadingEndpoints = isLoadingLeases || (!hasWaitExpired && endpoints.length === 0 && statuses.some(status => status.isPending));

  return {
    leases,
    isLoadingLeases,
    endpoints,
    isLoadingEndpoints,
    unreachableReason: resolveUnreachableReason({ isLoadingEndpoints, endpoints, liveLeaseCount: liveLeaseItems.length, statuses })
  };
}

function resolveUnreachableReason(input: {
  isLoadingEndpoints: boolean;
  endpoints: VisitEndpoint[];
  liveLeaseCount: number;
  statuses: { data?: unknown; isPending: boolean }[];
}): UnreachableReason | null {
  if (input.isLoadingEndpoints || input.endpoints.length > 0) return null;
  if (input.liveLeaseCount === 0) return "not-running";
  return input.statuses.every(status => !status.data) ? "provider-unreachable" : "no-public-endpoint";
}

function useHasWaitExpired(waitMs: number): boolean {
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(
    function stopWaitingEventually() {
      const timer = setTimeout(() => setHasExpired(true), waitMs);
      return () => clearTimeout(timer);
    },
    [waitMs]
  );

  return hasExpired;
}
