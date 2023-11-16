import { UseQueryOptions, useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { GraphResponse } from "@/types";
import { ApiUrlService } from "@/lib/apiUtils";

async function getGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.graphData(snapshot));
  return res.data;
}

export function useGraphSnapshot<TData = GraphResponse>(
  snapshot: string,
  options?: UseQueryOptions<GraphResponse, Error, TData, string[]>
): ReturnType<typeof useQuery> {
  return useQuery(QueryKeys.getGraphKey(snapshot), () => getGraphSnaphot(snapshot), options);
}

async function getProviderGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.providerGraphData(snapshot));
  return res.data;
}

export function useProviderGraphSnapshot<TData = GraphResponse>(
  snapshot: string,
  options?: UseQueryOptions<GraphResponse, Error, TData, string[]>
): ReturnType<typeof useQuery> {
  return useQuery(QueryKeys.getProviderGraphKey(snapshot), () => getProviderGraphSnaphot(snapshot), options);
}
