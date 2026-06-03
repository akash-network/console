import { useMemo } from "react";
import { isHttpError } from "@akashnetwork/http-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { millisecondsInMinute } from "date-fns/constants";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export function useDeploymentSettingQuery(params: { dseq: string }) {
  const queryKey = useMemo(() => QueryKeys.getDeploymentSettingKey(params.dseq), [params.dseq]);
  const { deploymentSetting } = useServices();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => deploymentSetting.findByDseq(params.dseq),
    enabled: !!params.dseq,
    staleTime: 5 * millisecondsInMinute,
    retry: (failureCount, error) => {
      if (isHttpError(error) && error.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    }
  });

  const update = useMutation({
    mutationFn: (autoTopUpEnabled: boolean) => {
      return deploymentSetting.updateByDseq(params.dseq, { autoTopUpEnabled });
    },
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data);
    }
  });

  const setAutoTopUpEnabled = (autoTopUpEnabled: boolean) => {
    update.mutate(autoTopUpEnabled);
  };

  return {
    data: query.data,
    update: update.mutate,
    setAutoTopUpEnabled,
    isLoading: query.isLoading || update.isPending,
    isFetching: query.isLoading,
    isUpdating: update.isPending,
    error: query.error
  };
}
