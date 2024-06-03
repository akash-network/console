import { QueryKey,useQuery, UseQueryOptions } from "react-query";
import axios from "axios";

import { useSettings } from "@src/context/SettingsProvider";
import { Block } from "@src/types";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

// Block
async function getBlock(apiEndpoint, id) {
  const response = await axios.get(ApiUrlService.block(apiEndpoint, id));

  return response.data;
}

export function useBlock(id, options = {}) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getBlockKey(id), () => getBlock(settings.apiEndpoint, id), {
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
