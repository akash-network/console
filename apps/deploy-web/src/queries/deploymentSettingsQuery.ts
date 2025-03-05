import { useMemo } from "react";
import { FindDeploymentSettingParams } from "@akashnetwork/http-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { millisecondsInMinute } from "date-fns/constants";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { QueryKeys } from "./queryKeys";

export function useDeploymentSettingQuery(params: Omit<FindDeploymentSettingParams, "userId"> & { userId?: string }) {
  const wallet = useWallet();
  const queryKey = useMemo(() => (params.userId ? QueryKeys.getDeploymentSettingKey(params.userId, params.dseq) : []), [params.userId, params.dseq]);
  const { deploymentSetting } = useServices();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!params.userId) {
        throw new Error("userId is required");
      }

      return deploymentSetting.findByUserIdAndDseq({ userId: params.userId, dseq: params.dseq });
    },
    enabled: !!params.userId && !!params.dseq && !!wallet.isManaged,
    staleTime: 5 * millisecondsInMinute,
    retry: (failureCount, error) => {
      if (error instanceof AxiosError && error.response?.status === 404) {
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

      if (!params.userId) {
        throw new Error("userId is required");
      }

      return deploymentSetting.update({ userId: params.userId, dseq: params.dseq }, { autoTopUpEnabled });
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
