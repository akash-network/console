import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "./queryKeys";

export const USE_API_KEYS_DEPENDENCIES = {
  useUser,
  useWallet
};

export function useUserApiKeys(
  options: Omit<UseQueryOptions<ApiKeyResponse[], Error, ApiKeyResponse[], QueryKey>, "queryKey" | "queryFn"> = {},
  dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES
) {
  const user = dependencies.useUser();
  const { isTrialing, isManaged } = dependencies.useWallet();
  const { apiKey } = useServices();

  return useQuery<ApiKeyResponse[], Error>({
    queryKey: QueryKeys.getApiKeysKey(user?.userId ?? ""),
    queryFn: async () => await apiKey.getApiKeys(),
    enabled: !!user?.userId && !isTrialing && isManaged,
    refetchInterval: 10_000,
    retry: failureCount => failureCount < 5,
    retryDelay: 10_000,
    ...options
  });
}

export function useCreateApiKey(dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES) {
  const user = dependencies.useUser();
  const queryClient = useQueryClient();
  const { apiKey } = useServices();

  return useMutation<ApiKeyResponse, Error, string>({
    mutationFn: (name: string) =>
      apiKey.createApiKey({
        data: {
          name: name
        }
      }),
    onSuccess: _response => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[] | undefined) => {
        if (!oldData) return [_response];
        return [...oldData, _response];
      });
    }
  });
}

export function useDeleteApiKey(id: string, onSuccess?: () => void, dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES) {
  const user = dependencies.useUser();
  const queryClient = useQueryClient();
  const { apiKey } = useServices();

  return useMutation({
    mutationFn: () => apiKey.deleteApiKey(id),
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[] = []) => {
        return oldData.filter(t => t.id !== id);
      });
      onSuccess?.();
    }
  });
}
