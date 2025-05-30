import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { BidDto, RpcBid } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

async function getBidList(apiEndpoint: string, address: string, dseq: string): Promise<Array<BidDto> | null> {
  if (!address || !dseq) return null;

  const response = await axios.get<{ bids: RpcBid[] }>(ApiUrlService.bidList(apiEndpoint, address, dseq));
  const { bids } = response.data;

  return bids.map((b: RpcBid) => ({
    id: b.bid.bid_id.provider + b.bid.bid_id.dseq + b.bid.bid_id.gseq + b.bid.bid_id.oseq,
    owner: b.bid.bid_id.owner,
    provider: b.bid.bid_id.provider,
    dseq: b.bid.bid_id.dseq,
    gseq: b.bid.bid_id.gseq,
    oseq: b.bid.bid_id.oseq,
    price: b.bid.price,
    state: b.bid.state,
    resourcesOffer: b.bid.resources_offer
  }));
}

export function useBidList(address: string, dseq: string, options?: Omit<UseQueryOptions<BidDto[] | null>, "queryKey" | "queryFn">) {
  const { settings } = useSettings();

  return useQuery({
    queryKey: QueryKeys.getBidListKey(address, dseq) as QueryKey,
    queryFn: () => getBidList(settings.apiEndpoint, address, dseq),
    ...options
  });
}

async function getBidInfo(apiEndpoint: string, address: string, dseq: string, gseq: number, oseq: number, provider: string): Promise<RpcBid | null> {
  if (!address || !dseq || !gseq || !oseq || !provider) return null;

  const response = await axios.get(ApiUrlService.bidInfo(apiEndpoint, address, dseq, gseq, oseq, provider));

  return response.data;
}

export function useBidInfo(address: string, dseq: string, gseq: number, oseq: number, provider: string, options = {}) {
  const { settings } = useSettings();
  return useQuery({
    queryKey: QueryKeys.getBidInfoKey(address, dseq, gseq, oseq, provider),
    queryFn: () => getBidInfo(settings.apiEndpoint, address, dseq, gseq, oseq, provider),
    ...options
  });
}
