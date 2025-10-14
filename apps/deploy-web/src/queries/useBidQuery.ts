import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { BidDto, RpcBid } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getBidList(apiClient: AxiosInstance, address: string, dseq: string): Promise<BidDto[] | null> {
  if (!address || !dseq) return null;

  const response = await apiClient.get<{ bids: RpcBid[] }>(ApiUrlService.bidList("", address, dseq));
  const { bids } = response.data;

  return bids.map(mapToBidDto);
}

export function mapToBidDto(b: RpcBid): BidDto {
  return {
    id: b.bid.id.provider + b.bid.id.dseq + b.bid.id.gseq + b.bid.id.oseq,
    owner: b.bid.id.owner,
    provider: b.bid.id.provider,
    dseq: b.bid.id.dseq,
    gseq: b.bid.id.gseq,
    oseq: b.bid.id.oseq,
    price: b.bid.price,
    state: b.bid.state,
    resourcesOffer: b.bid.resources_offer
  };
}

export function useBidList(address: string, dseq: string, options?: Omit<UseQueryOptions<BidDto[] | null>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();

  return useQuery({
    queryKey: QueryKeys.getBidListKey(address, dseq) as QueryKey,
    queryFn: () => getBidList(chainApiHttpClient, address, dseq),
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}

async function getBidInfo(apiClient: AxiosInstance, address: string, dseq: string, gseq: number, oseq: number, provider: string): Promise<RpcBid | null> {
  if (!address || !dseq || !gseq || !oseq || !provider) return null;

  const response = await apiClient.get(ApiUrlService.bidInfo("", address, dseq, gseq, oseq, provider));

  return response.data;
}

export function useBidInfo(
  address: string,
  dseq: string,
  gseq: number,
  oseq: number,
  provider: string,
  options?: Omit<UseQueryOptions<RpcBid | null>, "queryKey" | "queryFn">
) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getBidInfoKey(address, dseq, gseq, oseq, provider),
    queryFn: () => getBidInfo(chainApiHttpClient, address, dseq, gseq, oseq, provider),
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}
