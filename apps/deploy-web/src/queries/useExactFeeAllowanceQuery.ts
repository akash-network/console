import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactFeeAllowanceQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const { authzHttpService } = useServices();
  return useQuery({
    queryKey: QueryKeys.getFeeAllowancesKey(granter, grantee),
    queryFn: () => authzHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee),
    enabled
  });
}
