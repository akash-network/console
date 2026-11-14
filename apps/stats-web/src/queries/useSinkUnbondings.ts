import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { SinkUnbondings } from "@/types";

async function getSinkUnbondings(): Promise<SinkUnbondings> {
  const response = await axios.get(ApiUrlService.sinkUnbondings());
  return response.data;
}

export function useSinkUnbondings(options?: Omit<UseQueryOptions<SinkUnbondings, Error, SinkUnbondings, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<SinkUnbondings, Error>({
    queryKey: QueryKeys.getSinkUnbondingsKey(),
    queryFn: getSinkUnbondings,
    ...options
  });
}
