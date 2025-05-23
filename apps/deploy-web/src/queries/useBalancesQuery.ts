import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { Balances } from "@src/types";
import { QueryKeys } from "./queryKeys";

export function useBalances(address?: string, options?: Omit<UseQueryOptions<Balances | null>, "queryKey" | "queryFn">) {
  const di = useServices();
  return useQuery({
    queryKey: QueryKeys.getBalancesKey(address) as QueryKey,
    queryFn: () => (address ? di.walletBalancesService.getBalances(address) : null),
    enabled: !!address,
    ...options
  });
}
