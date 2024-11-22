import { useQuery } from "react-query";

import { useAllowanceService } from "@src/hooks/useAllowanceService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactDeploymentGrantsQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAllowanceService();
  return useQuery(QueryKeys.getDeploymentGrantsKey(granter, grantee), () => allowanceHttpService.getDeploymentGrantsForGranterAndGrantee(granter, grantee), {
    enabled
  });
}
