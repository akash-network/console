import { QueryKey, UseQueryOptions, useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { GraphResponse } from "@/types";
import { ApiUrlService } from "@/lib/apiUtils";

async function getGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.graphData(snapshot));
  return res.data;
}

export function useGraphSnapshot(snapshot: string, options?: Omit<UseQueryOptions<GraphResponse, Error, GraphResponse, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery(QueryKeys.getGraphKey(snapshot), () => getGraphSnaphot(snapshot), options);
}

async function getProviderGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.providerGraphData(snapshot));
  return res.data;
}

export function useProviderGraphSnapshot(snapshot: string, options?: Omit<UseQueryOptions<GraphResponse, Error, GraphResponse, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery(QueryKeys.getProviderGraphKey(snapshot), () => getProviderGraphSnaphot(snapshot), options);
}
