import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

export type DeploymentFundingConfig = paths["/v1/deployment-funding-config"]["get"]["responses"][200]["content"]["application/json"]["data"];

export const useDeploymentFundingConfigQuery = () => {
  const { api } = useServices();
  return api.v1.getDeploymentFundingConfig.useQuery(undefined, {
    select: response => response.data,
    staleTime: Infinity
  });
};
