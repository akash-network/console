import type { paths } from "@akashnetwork/console-api-types";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export const useWalletSettingsQuery = (
  options?: Omit<UseQueryOptions<WalletSettings>, "queryKey" | "queryFn">
): UseQueryResult<WalletSettings["data"] | null> => {
  const { api } = useServices();
  return api.v1.getWalletSettings.useQuery(undefined, {
    ...options,
    catchError(error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    },
    select: response => response?.data ?? null
  });
};

export const useWalletSettingsMutations = () => {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const invalidateGetWalletSettingsQuery = () => {
    queryClient.invalidateQueries({ queryKey: api.v1.getWalletSettings.getKey() });
  };

  const updateWalletSettings = api.v1.updateWalletSettings.useMutation({
    onSuccess: invalidateGetWalletSettingsQuery
  });

  const createWalletSettings = api.v1.createWalletSettings.useMutation({
    onSuccess: invalidateGetWalletSettingsQuery
  });

  const deleteWalletSettings = api.v1.deleteWalletSettings.useMutation({
    onSuccess: invalidateGetWalletSettingsQuery
  });

  return {
    updateWalletSettings,
    upsertWalletSettings: updateWalletSettings,
    createWalletSettings,
    deleteWalletSettings
  };
};

type WalletSettings = paths["/v1/wallet-settings"]["get"]["responses"][200]["content"]["application/json"];
