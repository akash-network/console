import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { Block } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

// Block
async function getBlock(apiEndpoint, id) {
  const response = await axios.get(ApiUrlService.block(apiEndpoint, id));

  return response.data;
}

export function useBlock(id, options = {}) {
  return useQuery(QueryKeys.getBlockKey(id), () => getBlock(browserEnvConfig.NEXT_PUBLIC_MAINNET_API_URL, id), {
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options
  });
}

async function getBlocks(limit: number): Promise<Block[]> {
  const response = await axios.get(ApiUrlService.blocks(limit));
  return response.data;
}

export function useBlocks(limit: number, options?: Omit<UseQueryOptions<Block[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<Block[], Error>(QueryKeys.getBlocksKey(limit), () => getBlocks(limit), options);
}
