import type { QueryKey, UseQueryOptions } from "react-query";
import { useQuery } from "react-query";
import axios from "axios";
import { z } from "zod";

import { useLocalNotes } from "@src/context/LocalNoteProvider";
import type { PaginatedResults } from "@src/types";
import type { DeploymentDto, RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { coinToUDenom } from "@src/utils/priceUtils";
import { removeEmptyFilters } from "@src/utils/urlUtils";
import type { DeploymentRowType } from "@src/utils/zod/deploymentRow";
import { deploymentRowSchema } from "@src/utils/zod/deploymentRow";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

// Deployment list
async function getDeploymentList(apiEndpoint: string, address: string) {
  if (!address) return [];

  const deployments = await loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList(apiEndpoint, address), "deployments", 1000);

  return deployments.map(d => deploymentToDto(d));
}

export function useDeploymentList(address: string, options: UseQueryOptions<DeploymentDto[] | null>) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDeploymentListKey(address) as QueryKey, () => getDeploymentList(settings.apiEndpoint, address), options);
}

// Deployment detail
async function getDeploymentDetail(apiEndpoint: string, address: string, dseq: string) {
  if (!address || !apiEndpoint) return null;

  const response = await axios.get(ApiUrlService.deploymentDetail(apiEndpoint, address, dseq));

  return deploymentToDto(response.data);
}

export function useDeploymentDetail(address: string, dseq: string, options: UseQueryOptions<DeploymentDto | null>) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDeploymentDetailKey(address, dseq) as QueryKey, () => getDeploymentDetail(settings.apiEndpoint, address, dseq), options);
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
