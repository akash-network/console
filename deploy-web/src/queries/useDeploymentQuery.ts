import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { useSettings } from "../context/SettingsProvider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";

// Deployment list
async function getDeploymentList(apiEndpoint: string, address: string) {
  if (!address) return [];

  const deployments = await loadWithPagination(ApiUrlService.deploymentList(apiEndpoint, address), "deployments", 1000);

  return deployments.map(d => deploymentToDto(d));
}

export function useDeploymentList(address: string, options) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDeploymentListKey(address), () => getDeploymentList(settings.apiEndpoint, address), options);
}

// Deployment detail
async function getDeploymentDetail(apiEndpoint: string, address: string, dseq: string) {
  if (!address) return null;

  const response = await axios.get(ApiUrlService.deploymentDetail(apiEndpoint, address, dseq));

  return deploymentToDto(response.data);
}

export function useDeploymentDetail(address: string, dseq: string, options) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDeploymentDetailKey(address, dseq), () => getDeploymentDetail(settings.apiEndpoint, address, dseq), options);
}
