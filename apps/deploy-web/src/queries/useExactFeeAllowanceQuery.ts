import { useQuery } from "react-query";

import { useAuthZService } from "@src/hooks/useAuthZService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactFeeAllowanceQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAuthZService();
  return useQuery(QueryKeys.getFeeAllowancesKey(granter, grantee), () => allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee), {
    enabled
  });
}
