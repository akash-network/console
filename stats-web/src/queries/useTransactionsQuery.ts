import { UseQueryOptions, useQuery, QueryKey } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { ApiUrlService } from "@/lib/apiUtils";
import { PaginatedResults, TransactionDetail } from "@/types";
import { removeEmptyFilters } from "@/lib/urlUtils";
import { z } from "zod";
import { transactionRowSchema } from "@/lib/zod/transactionRow";
import { DeploymentRowType, deploymentRowSchema } from "@/lib/zod/deploymentRow";

async function getTransactions(limit: number): Promise<TransactionDetail[]> {
  const response = await axios.get(ApiUrlService.transactions(limit));
  return response.data;
}

export function useTransactions(limit: number, options?: Omit<UseQueryOptions<TransactionDetail[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<TransactionDetail[], Error>(QueryKeys.getTransactionsKey(limit), () => getTransactions(limit), options);
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
  return useQuery<PaginatedResults<TransactionDetail>, Error>(
    QueryKeys.getAddressTransactionsKey(address, skip, limit),
    () => getAddressTransactions(address, skip, limit),
    options
  );
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
  return useQuery<PaginatedResults<DeploymentRowType>, Error>(
    QueryKeys.getAddressDeploymentsKey(address, skip, limit, reverseSorting, removeEmptyFilters(filters)),
    () => getAddressDeployments(address, skip, limit, reverseSorting, removeEmptyFilters(filters)),
    options
  );
}