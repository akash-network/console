import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { DeploymentDto, RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

// Deployment list
async function getDeploymentList(apiEndpoint: string, address: string) {
  if (!address) return [];

  const deployments = await loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList(apiEndpoint, address), "deployments", 1000);

  return deployments.map(d => deploymentToDto(d));
}

export function useDeploymentList(address: string, options?: Omit<UseQueryOptions<DeploymentDto[] | null>, "queryKey" | "queryFn">) {
  const { settings } = useSettings();
  return useQuery({
    queryKey: QueryKeys.getDeploymentListKey(address),
    queryFn: () => getDeploymentList(settings.apiEndpoint, address),
    ...options
  });
}

// Deployment detail
async function getDeploymentDetail(apiEndpoint: string, address: string, dseq: string) {
  if (!address || !apiEndpoint) return null;

  const response = await axios.get(ApiUrlService.deploymentDetail(apiEndpoint, address, dseq));

  return deploymentToDto(response.data);
}

export function useDeploymentDetail(address: string, dseq: string, options?: Omit<UseQueryOptions<DeploymentDto | null>, "queryKey" | "queryFn">) {
  const { settings } = useSettings();
  return useQuery({
    queryKey: QueryKeys.getDeploymentDetailKey(address, dseq) as QueryKey,
    queryFn: () => getDeploymentDetail(settings.apiEndpoint, address, dseq),
    ...options
  });
}
