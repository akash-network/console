import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import { Block } from "@/types";

async function getBlocks(limit: number): Promise<Block[]> {
  const response = await axios.get(ApiUrlService.blocks(limit));
  return response.data;
}

export function useBlocks(limit: number, options?: Omit<UseQueryOptions<Block[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<Block[], Error>(QueryKeys.getBlocksKey(limit), () => getBlocks(limit), options);
}
