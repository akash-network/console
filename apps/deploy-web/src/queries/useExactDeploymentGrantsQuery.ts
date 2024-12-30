import { useQuery } from "react-query";

import { useAuthZService } from "@src/hooks/useAuthZService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactDeploymentGrantsQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAuthZService();
  return useQuery(
    QueryKeys.getDeploymentGrantsKey(granter, grantee),
    () => allowanceHttpService.getDepositDeploymentGrantsForGranterAndGrantee(granter, grantee),
    {
      enabled
    }
  );
}
