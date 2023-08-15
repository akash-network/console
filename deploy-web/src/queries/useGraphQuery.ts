import { GraphResponse } from "@src/types";
import { UseQueryOptions, useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { ApiUrlService } from "@src/utils/apiUtils";

async function getGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.graphData(snapshot));
  return res.data;
}

export function useGraphSnapshot<TData = GraphResponse>(snapshot: string, options?: UseQueryOptions<GraphResponse, Error, TData>) {
  return useQuery(QueryKeys.getGraphKey(snapshot), () => getGraphSnaphot(snapshot), options);
}

async function getProviderGraphSnaphot(snapshot: string): Promise<GraphResponse> {
  const res = await axios.get(ApiUrlService.providerGraphData(snapshot));
  return res.data;
}

export function useProviderGraphSnapshot<TData = GraphResponse>(snapshot: string, options?: UseQueryOptions<GraphResponse, Error, TData>) {
  return useQuery(QueryKeys.getProviderGraphKey(snapshot), () => getProviderGraphSnaphot(snapshot), options);
}
