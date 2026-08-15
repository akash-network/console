import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentDto, DeploymentStatus, RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { QueryKeys } from "./queryKeys";

/** Fetches every deployment of the given state; used where aggregates need the full set. */
async function getDeploymentList(chainApiHttpClient: AxiosInstance, address: string, state?: DeploymentStatus) {
  if (!address) return [];

  const deployments = await loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList("", address, state), "deployments", 1000, chainApiHttpClient);

  return deployments.map(d => deploymentToDto(d));
}

export function useDeploymentList(address: string, options?: Omit<UseQueryOptions<DeploymentDto[] | null>, "queryKey" | "queryFn">, state?: DeploymentStatus) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentListKey(address, state),
    queryFn: () => getDeploymentList(chainApiHttpClient, address, state),
    ...options
  });
}

/** `hasNextPage` comes from RPC `pagination.next_key`. `pagination.total` is the current page size, not the collection size. */
export interface DeploymentsPage {
  deployments: DeploymentDto[];
  hasNextPage: boolean;
}

type DeploymentsPageParams = {
  state: DeploymentStatus;
  skip: number;
  limit: number;
};

async function getDeploymentsPage(chainApiHttpClient: AxiosInstance, address: string, params: DeploymentsPageParams): Promise<DeploymentsPage> {
  if (!address) return { deployments: [], hasNextPage: false };

  const { state, skip, limit } = params;
  const response = await chainApiHttpClient.get(ApiUrlService.deploymentsPage("", { owner: address, state, offset: skip, limit, reverse: true }));
  const deployments = (response.data.deployments as RpcDeployment[]).map(d => deploymentToDto(d));

  return {
    deployments,
    hasNextPage: Boolean(response.data.pagination?.next_key)
  };
}

/** Positions within the tuple returned by {@link QueryKeys.getDeploymentsPageKey}. */
const DEPLOYMENTS_PAGE_ADDRESS_KEY_INDEX = 1;
const DEPLOYMENTS_PAGE_STATE_KEY_INDEX = 2;

/**
 * Retains the last page while paging within one account and status, but drops it across an
 * account switch or an Active/Closed switch so the prior view's rows never render under the
 * newly selected one while its own data loads.
 */
function keepPreviousPageOfSameStatus(address: string, state: DeploymentStatus) {
  return (previousData: DeploymentsPage | undefined, previousQuery: { queryKey: QueryKey } | undefined) => {
    if (!previousQuery) return undefined;
    const sameAccount = previousQuery.queryKey[DEPLOYMENTS_PAGE_ADDRESS_KEY_INDEX] === address;
    const sameStatus = previousQuery.queryKey[DEPLOYMENTS_PAGE_STATE_KEY_INDEX] === state;
    return sameAccount && sameStatus ? previousData : undefined;
  };
}

export function useDeploymentsPage(address: string, params: DeploymentsPageParams, options?: Omit<UseQueryOptions<DeploymentsPage>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentsPageKey(address, params.state, params.skip, params.limit),
    queryFn: () => getDeploymentsPage(chainApiHttpClient, address, params),
    placeholderData: keepPreviousPageOfSameStatus(address, params.state),
    ...options
  });
}

// Deployment detail
async function getDeploymentDetail(chainApiHttpClient: AxiosInstance, address: string, dseq: string) {
  if (!address || !chainApiHttpClient.defaults.baseURL) return null;

  const response = await chainApiHttpClient.get(ApiUrlService.deploymentDetail("", address, dseq));

  return deploymentToDto(response.data);
}

export function useDeploymentDetail(address: string, dseq: string, options?: Omit<UseQueryOptions<DeploymentDto | null>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentDetailKey(address, dseq) as QueryKey,
    queryFn: () => getDeploymentDetail(chainApiHttpClient, address, dseq),
    ...options
  });
}
