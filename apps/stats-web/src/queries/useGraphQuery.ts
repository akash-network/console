import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { GraphResponse } from "@/types";

async function getGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.graphData(snapshot));
  return res.data;
}

export function useGraphSnapshot(snapshot: string, options?: Omit<UseQueryOptions<GraphResponse, Error, GraphResponse, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: QueryKeys.getGraphKey(snapshot),
    queryFn: () => getGraphSnaphot(snapshot),
    ...options
  });
}

async function getProviderGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.providerGraphData(snapshot));
  return res.data;
}

export function useProviderGraphSnapshot(
  snapshot: string,
  options?: Omit<UseQueryOptions<GraphResponse, Error, GraphResponse, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: QueryKeys.getProviderGraphKey(snapshot),
    queryFn: () => getProviderGraphSnaphot(snapshot),
    ...options
  });
}
