import { useQuery } from "@tanstack/react-query";

import { useAuthZService } from "@src/hooks/useAuthZService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactFeeAllowanceQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAuthZService();
  return useQuery({
    queryKey: QueryKeys.getFeeAllowancesKey(granter, grantee),
    queryFn: () => allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee),
    enabled
  });
}
