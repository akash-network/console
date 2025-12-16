import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export const useWeeklyDeploymentCostQuery = (options?: Omit<UseQueryOptions<number>, "queryKey" | "queryFn">) => {
  const { managedDeployment } = useServices();
  return useQuery<number>({
    ...options,
    queryKey: QueryKeys.getWeeklyDeploymentCostKey(),
    queryFn: async () => {
      return await managedDeployment.getWeeklyDeploymentCost();
    }
  });
};
