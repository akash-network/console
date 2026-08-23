import { useMemo } from "react";
import type { UpdateDeploymentSettingInput } from "@akashnetwork/http-sdk";
import { isHttpError } from "@akashnetwork/http-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { millisecondsInMinute } from "date-fns/constants";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

/**
 * Patches a deployment's settings and writes the response straight back into the settings query, so a
 * caller that has no query of its own (the review modal, which patches a deployment it is about to
 * deploy) still leaves the detail page's cache correct.
 */
export function useUpdateDeploymentSettingMutation(params: { dseq: string }) {
  const queryKey = useMemo(() => QueryKeys.getDeploymentSettingKey(params.dseq), [params.dseq]);
  const { deploymentSetting } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDeploymentSettingInput) => deploymentSetting.updateByDseq(params.dseq, input),
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data);
    }
  });
}

export function useDeploymentSettingQuery(params: { dseq: string }) {
  const queryKey = useMemo(() => QueryKeys.getDeploymentSettingKey(params.dseq), [params.dseq]);
  const { deploymentSetting } = useServices();

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

  const update = useUpdateDeploymentSettingMutation(params);

  const setAutoTopUpEnabled = (autoTopUpEnabled: boolean) => {
    update.mutate({ autoTopUpEnabled });
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
