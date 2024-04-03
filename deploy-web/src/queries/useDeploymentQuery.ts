import { QueryKey, UseQueryOptions, useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { useSettings } from "../context/SettingsProvider";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { z } from "zod";
import { DeploymentRowType, deploymentRowSchema } from "@src/utils/zod/deploymentRow";
import { PaginatedResults } from "@src/types";
import { removeEmptyFilters } from "@src/utils/urlUtils";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { coinToUDenom } from "@src/utils/priceUtils";

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

async function getAddressDeployments(
  address: string,
  skip: number,
  limit: number,
  reverseSorting: boolean,
  filters: { [key: string]: string },
  getDeploymentName: (dseq: string | number) => string | null | undefined
) {
  const response = await axios.get(ApiUrlService.addressDeployments(address, skip, limit, reverseSorting, filters));
  const data = z.array(deploymentRowSchema).parse(
    response.data.results.map((d: DeploymentRowType) => {
      const name = getDeploymentName(d.dseq);
      let escrowBalanceUAkt = coinToUDenom(d.escrowAccount.balance);
      if (d.escrowAccount.funds) {
        escrowBalanceUAkt += coinToUDenom(d.escrowAccount.funds);
      }

      return {
        ...d,
        escrowBalance: escrowBalanceUAkt,
        name
      };
    })
  ) as unknown as DeploymentRowType[];

  return { results: data, count: response.data.count };
}

export function useAddressDeployments(
  address: string,
  skip: number,
  limit: number,
  reverseSorting: boolean,
  filters: { [key: string]: string } = {},
  options?: Omit<UseQueryOptions<PaginatedResults<DeploymentRowType>, Error, any, QueryKey>, "queryKey" | "queryFn">
) {
  const { getDeploymentName } = useLocalNotes();
  return useQuery<PaginatedResults<DeploymentRowType>, Error>(
    QueryKeys.getAddressDeploymentsKey(address, skip, limit, reverseSorting, removeEmptyFilters(filters)),
    () => getAddressDeployments(address, skip, limit, reverseSorting, removeEmptyFilters(filters), getDeploymentName),
    options
  );
}
