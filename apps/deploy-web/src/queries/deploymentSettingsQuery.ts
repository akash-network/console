import { useMemo } from "react";
import type { DeploymentSettingOutput, UpdateDeploymentSettingInput } from "@akashnetwork/http-sdk";
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

/** Cadence for re-polling a runtime limit whose deadline the lease has not anchored yet. */
export const RUNTIME_ANCHOR_POLL_MS = 5_000;

/**
 * A runtime limit's deadline is anchored server-side at lease start, so a detail page opened before the
 * lease starts caches a null deadline and, under this query's stale window, would hold the pre-countdown
 * reading until a manual page reload. Poll until the deadline lands; a failed fetch stops it so a
 * persistent error does not retry forever.
 */
export function getRuntimeAnchorPollInterval(setting: DeploymentSettingOutput | undefined, hasErrored: boolean): number | false {
  if (hasErrored) return false;
  return !!setting?.runtimeLimitHours && !setting.runtimeEndsAt ? RUNTIME_ANCHOR_POLL_MS : false;
}

export function useDeploymentSettingQuery(params: { dseq: string }) {
  const queryKey = useMemo(() => QueryKeys.getDeploymentSettingKey(params.dseq), [params.dseq]);
  const { deploymentSetting } = useServices();

  const query = useQuery({
    queryKey,
    queryFn: () => deploymentSetting.findByDseq(params.dseq),
    enabled: !!params.dseq,
    staleTime: 5 * millisecondsInMinute,
    refetchInterval: query => getRuntimeAnchorPollInterval(query.state.data, query.state.status === "error"),
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
