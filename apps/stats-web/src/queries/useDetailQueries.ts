import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { AddressDetail, BlockDetail, DeploymentDetail, TransactionDetail, ValidatorDetail } from "@/types";

async function getBlock(height: string): Promise<BlockDetail> {
  const response = await axios.get(ApiUrlService.block(height));
  return response.data;
}

export function useBlock(height: string, options?: Omit<UseQueryOptions<BlockDetail, Error, BlockDetail, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<BlockDetail, Error>({
    queryKey: QueryKeys.getBlockKey(height),
    queryFn: () => getBlock(height),
    enabled: !!height,
    ...options
  });
}

async function getTransaction(hash: string): Promise<TransactionDetail> {
  const response = await axios.get(ApiUrlService.transaction(hash));
  return response.data;
}

export function useTransaction(hash: string, options?: Omit<UseQueryOptions<TransactionDetail, Error, TransactionDetail, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<TransactionDetail, Error>({
    queryKey: QueryKeys.getTransactionKey(hash),
    queryFn: () => getTransaction(hash),
    enabled: !!hash,
    ...options
  });
}

async function getValidator(address: string): Promise<ValidatorDetail> {
  const response = await axios.get(ApiUrlService.validator(address));
  return response.data;
}

export function useValidator(
  address: string,
  options?: Omit<UseQueryOptions<ValidatorDetail, Error, ValidatorDetail, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery<ValidatorDetail, Error>({
    queryKey: QueryKeys.getValidatorKey(address),
    queryFn: () => getValidator(address),
    enabled: !!address,
    ...options
  });
}

async function getAddress(address: string): Promise<AddressDetail> {
  const response = await axios.get(ApiUrlService.address(address));
  return response.data;
}

export function useAddress(address: string, options?: Omit<UseQueryOptions<AddressDetail, Error, AddressDetail, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<AddressDetail, Error>({
    queryKey: QueryKeys.getAddressKey(address),
    queryFn: () => getAddress(address),
    enabled: !!address,
    ...options
  });
}

async function getDeployment(address: string, dseq: string): Promise<DeploymentDetail> {
  const response = await axios.get(ApiUrlService.deployment(address, dseq));
  return response.data;
}

export function useDeployment(
  address: string,
  dseq: string,
  options?: Omit<UseQueryOptions<DeploymentDetail, Error, DeploymentDetail, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery<DeploymentDetail, Error>({
    queryKey: QueryKeys.getDeploymentKey(address, dseq),
    queryFn: () => getDeployment(address, dseq),
    enabled: !!address && !!dseq,
    ...options
  });
}
