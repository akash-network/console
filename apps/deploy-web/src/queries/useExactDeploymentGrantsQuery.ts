import { useQuery } from "@tanstack/react-query";

import { useAuthZService } from "@src/hooks/useAuthZService";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactDeploymentGrantsQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const allowanceHttpService = useAuthZService();
  return useQuery({
    queryKey: QueryKeys.getDeploymentGrantsKey(granter, grantee),
    queryFn: async () => {
      const grant = await allowanceHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(granter, grantee);
      return grant ? { ...grant, granter, grantee } : null;
    },
    enabled
  });
}
