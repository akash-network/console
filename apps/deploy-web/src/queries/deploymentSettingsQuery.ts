import { useMemo } from "react";
import { isHttpError } from "@akashnetwork/http-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { millisecondsInMinute } from "date-fns/constants";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { QueryKeys } from "./queryKeys";

export const USE_DEPLOYMENT_SETTING_DEPENDENCIES = { useWallet };

export function useDeploymentSettingQuery(
  params: { dseq: string },
  dependencies: typeof USE_DEPLOYMENT_SETTING_DEPENDENCIES = USE_DEPLOYMENT_SETTING_DEPENDENCIES
) {
  const wallet = dependencies.useWallet();
  const queryKey = useMemo(() => QueryKeys.getDeploymentSettingKey(params.dseq), [params.dseq]);
  const { deploymentSetting } = useServices();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => deploymentSetting.findByDseq(params.dseq),
    enabled: !!params.dseq && !!wallet.isManaged,
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
      if (!wallet.isManaged) {
        throw new Error("Cannot update deployment setting for a custodial wallet");
      }

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
