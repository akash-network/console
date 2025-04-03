import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import { removeEmptyFilters } from "@/lib/urlUtils";
import type { DeploymentRowType } from "@/lib/zod/deploymentRow";
import { deploymentRowSchema } from "@/lib/zod/deploymentRow";
import type { PaginatedResults, TransactionDetail } from "@/types";

async function getTransactions(limit: number): Promise<TransactionDetail[]> {
  const response = await axios.get(ApiUrlService.transactions(limit));
  return response.data;
}

export function useTransactions(limit: number, options?: Omit<UseQueryOptions<TransactionDetail[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<TransactionDetail[], Error>({
    queryKey: QueryKeys.getTransactionsKey(limit),
    queryFn: () => getTransactions(limit),
    ...options
  });
}

async function getAddressTransactions(address: string, skip: number, limit: number) {
  const response = await axios.get(ApiUrlService.addressTransactions(address, skip, limit));
  return response.data;
}

export function useAddressTransactions(
  address: string,
  skip: number,
  limit: number,
  options?: Omit<UseQueryOptions<PaginatedResults<TransactionDetail>, Error, any, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResults<TransactionDetail>, Error>({
    queryKey: QueryKeys.getAddressTransactionsKey(address, skip, limit),
    queryFn: () => getAddressTransactions(address, skip, limit),
    ...options
  });
}

async function getAddressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
  const response = await axios.get(ApiUrlService.addressDeployments(address, skip, limit, reverseSorting, filters));
  const data = z.array(deploymentRowSchema).parse(response.data.results) as unknown as DeploymentRowType[];

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
  return useQuery<PaginatedResults<DeploymentRowType>, Error>({
    queryKey: QueryKeys.getAddressDeploymentsKey(address, skip, limit, reverseSorting, removeEmptyFilters(filters)),
    queryFn: () => getAddressDeployments(address, skip, limit, reverseSorting, removeEmptyFilters(filters)),
    ...options
  });
}
