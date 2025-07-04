import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";

export function useExactDeploymentGrantsQuery(granter: string, grantee: string, { enabled = true } = {}) {
  const { authzHttpService } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDeploymentGrantsKey(granter, grantee),
    queryFn: async () => {
      const grant = await authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(granter, grantee);
      return grant ? { ...grant, granter, grantee } : null;
    },
    enabled
  });
}
