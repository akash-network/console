import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentDto, DeploymentStatus, RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { QueryKeys } from "./queryKeys";

// Deployment list (fetches every deployment of the given state; used where aggregates need the full set)
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

export interface DeploymentsPage {
  deployments: DeploymentDto[];
  total?: number;
}

type DeploymentsPageParams = {
  state: DeploymentStatus;
  skip: number;
  limit: number;
  countTotal?: boolean;
};

async function getDeploymentsPage(chainApiHttpClient: AxiosInstance, address: string, params: DeploymentsPageParams): Promise<DeploymentsPage> {
  if (!address) return { deployments: [], total: 0 };

  const { state, skip, limit, countTotal } = params;
  const response = await chainApiHttpClient.get(ApiUrlService.deploymentsPage("", { owner: address, state, offset: skip, limit, countTotal, reverse: true }));
  const deployments = (response.data.deployments as RpcDeployment[]).map(d => deploymentToDto(d));

  return {
    deployments,
    total: countTotal ? Number(response.data.pagination.total) : undefined
  };
}

/** Position of `state` within the tuple returned by {@link QueryKeys.getDeploymentsPageKey}. */
const DEPLOYMENTS_PAGE_STATE_KEY_INDEX = 2;

/**
 * Retains the last page while paging within one status, but drops it across an Active/Closed
 * switch so the prior tab's rows and total never render under the newly selected tab while its
 * own data loads.
 */
function keepPreviousPageOfSameStatus(state: DeploymentStatus) {
  return (previousData: DeploymentsPage | undefined, previousQuery: { queryKey: QueryKey } | undefined) =>
    previousQuery?.queryKey[DEPLOYMENTS_PAGE_STATE_KEY_INDEX] === state ? previousData : undefined;
}

export function useDeploymentsPage(address: string, params: DeploymentsPageParams, options?: Omit<UseQueryOptions<DeploymentsPage>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentsPageKey(address, params.state, params.skip, params.limit),
    queryFn: () => getDeploymentsPage(chainApiHttpClient, address, params),
    placeholderData: keepPreviousPageOfSameStatus(params.state),
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
