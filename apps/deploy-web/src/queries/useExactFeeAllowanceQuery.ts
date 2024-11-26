import { useQuery } from "react-query";

import { useAllowanceService } from "@src/hooks/useAllowanceService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactFeeAllowanceQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAllowanceService();
  return useQuery(QueryKeys.getFeeAllowancesKey(granter, grantee), () => allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee), {
    enabled
  });
}
