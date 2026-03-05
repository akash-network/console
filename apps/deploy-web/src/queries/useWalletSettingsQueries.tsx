import type { UpdateWalletSettingsParams, WalletSettings } from "@akashnetwork/http-sdk";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export const useWalletSettingsQuery = (options?: Omit<UseQueryOptions<WalletSettings>, "queryKey" | "queryFn">) => {
  const { walletSettings } = useServices();
  return useQuery<WalletSettings>({
    ...options,
    queryKey: QueryKeys.getWalletSettingsKey(),
    queryFn: async () => {
      return await walletSettings.getWalletSettings();
    }
  });
};

export const useWalletSettingsMutations = () => {
  const { walletSettings } = useServices();
  const queryClient = useQueryClient();

  const updateWalletSettings = useMutation({
    mutationFn: async (settings: UpdateWalletSettingsParams): Promise<WalletSettings> => {
      return await walletSettings.updateWalletSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.getWalletSettingsKey() });
    }
  });

  const createWalletSettings = useMutation({
    mutationFn: async (settings: WalletSettings): Promise<WalletSettings> => {
      return await walletSettings.createWalletSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.getWalletSettingsKey() });
    }
  });

  const deleteWalletSettings = useMutation({
    mutationFn: async (): Promise<void> => {
      return await walletSettings.deleteWalletSettings();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.getWalletSettingsKey() });
    }
  });

  return {
    updateWalletSettings,
    upsertWalletSettings: updateWalletSettings,
    createWalletSettings,
    deleteWalletSettings
  };
};
