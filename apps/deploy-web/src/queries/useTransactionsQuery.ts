import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";

import { PaginatedResults, TransactionDetail } from "@src/types";
import { DeploymentSummary } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { removeEmptyFilters } from "@src/utils/urlUtils";
import { QueryKeys } from "./queryKeys";

async function getTransactions(limit: number): Promise<TransactionDetail[]> {
  const response = await axios.get(ApiUrlService.transactions(limit));
  return response.data;
}

export function useTransactions(limit: number, options?: Omit<UseQueryOptions<TransactionDetail[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
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
  return useQuery({
    queryKey: QueryKeys.getAddressTransactionsKey(address, skip, limit),
    queryFn: () => getAddressTransactions(address, skip, limit),
    ...options
  });
}

async function getAddressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
  const response = await axios.get(ApiUrlService.addressDeployments(address, skip, limit, reverseSorting, filters));
  return response.data;
}

export function useAddressDeployments(
  address: string,
  skip: number,
  limit: number,
  reverseSorting: boolean,
  filters?: { [key: string]: string },
  options?: Omit<UseQueryOptions<PaginatedResults<DeploymentSummary>, Error, any, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: QueryKeys.getAddressDeploymentsKey(address, skip, limit, reverseSorting, removeEmptyFilters(filters || {})),
    queryFn: () => getAddressDeployments(address, skip, limit, reverseSorting, removeEmptyFilters(filters || {})),
    ...options
  });
}