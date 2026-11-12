import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import type { PaginatedResults, SinkTransfer, SinkTransferSort } from "@/types";

type SinkTransfersPage = PaginatedResults<SinkTransfer>;

async function getSinkTransfers(sort: SinkTransferSort, limit: number): Promise<SinkTransfersPage> {
  const response = await axios.get(ApiUrlService.sinkTransfers(sort, limit));
  return response.data;
}

export function useSinkTransfers(
  sort: SinkTransferSort,
  limit: number,
  options?: Omit<UseQueryOptions<SinkTransfersPage, Error, SinkTransfersPage, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery<SinkTransfersPage, Error>({
    queryKey: QueryKeys.getSinkTransfersKey(sort, limit),
    queryFn: () => getSinkTransfers(sort, limit),
    placeholderData: keepPreviousData,
    ...options
  });
}
