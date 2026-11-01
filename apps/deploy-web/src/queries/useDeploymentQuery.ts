import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { DeploymentDto, RpcDeployment } from "@src/types/deployment";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { QueryKeys } from "./queryKeys";

export function useDeploymentDetail(address: string, dseq: string, options?: Omit<UseQueryOptions<DeploymentDto | null>, "queryKey" | "queryFn">) {
  const { api } = useServices();

  return useQuery({
    queryKey: QueryKeys.getDeploymentDetailKey(address, dseq) as QueryKey,
    queryFn: async () => {
      if (!address) return null;
      const { data } = await api.v1.getDeploymentInfo.queryOptions({ dseq }).queryFn();
      return deploymentToDto(data as RpcDeployment);
    },
    ...options
  });
}
