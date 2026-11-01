import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export function useFeeAllowanceExistenceQuery(address: string, options: Omit<UseQueryOptions<boolean>, "queryKey" | "queryFn"> = {}) {
  const { api } = useServices();

  return useQuery({
    queryKey: QueryKeys.getFeeAllowanceExistenceKey(address),
    queryFn: async () => (await api.v1.listFeeAllowances.queryOptions().queryFn()).data.length > 0,
    ...options
  });
}
