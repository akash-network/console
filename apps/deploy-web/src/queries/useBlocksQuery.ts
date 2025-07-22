import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { Block } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useBlock(id: string, options = {}) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getBlockKey(id),
    queryFn: () => chainApiHttpClient.get(ApiUrlService.block("", id)).then(response => response.data),
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options
  });
}

export function useBlocks(limit: number, options?: Omit<UseQueryOptions<Block[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { consoleApiHttpClient } = useServices();
  return useQuery<Block[], Error>({
    queryKey: QueryKeys.getBlocksKey(limit),
    queryFn: () => consoleApiHttpClient.get(ApiUrlService.blocks(limit)).then(response => response.data),
    ...options
  });
}
