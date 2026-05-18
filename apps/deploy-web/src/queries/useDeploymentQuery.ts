import { getAllItems } from "@akashnetwork/http-sdk";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentDto, RpcDeployment } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { QueryKeys } from "./queryKeys";

// Deployment list
async function getDeploymentList(chainApiHttpClient: AxiosInstance, address: string) {
  if (!address) return [];

  const deployments = await getAllItems<RpcDeployment>(async params => {
    const response = await chainApiHttpClient.get(ApiUrlService.deploymentList("", address), {
      params: { "pagination.limit": 1000, ...params }
    });
    return { items: response.data.deployments, pagination: response.data.pagination };
  });

  return deployments.map(d => deploymentToDto(d));
}

export function useDeploymentList(address: string, options?: Omit<UseQueryOptions<DeploymentDto[] | null>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentListKey(address),
    queryFn: () => getDeploymentList(chainApiHttpClient, address),
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
