import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";

export interface BmeStatusHistoryEntry {
  height: number;
  date: string;
  previousStatus: string;
  newStatus: string;
  collateralRatio: number;
}

export type BmeStatusHistoryResponse = BmeStatusHistoryEntry[];

async function getBmeStatusHistory(): Promise<BmeStatusHistoryResponse> {
  const res = await axios.get(ApiUrlService.bmeStatusHistory());
  return res.data;
}

export function useBmeStatusHistory(
  options?: Omit<UseQueryOptions<BmeStatusHistoryResponse, Error, BmeStatusHistoryResponse, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: QueryKeys.getBmeStatusHistoryKey(),
    queryFn: getBmeStatusHistory,
    ...options
  });
}
