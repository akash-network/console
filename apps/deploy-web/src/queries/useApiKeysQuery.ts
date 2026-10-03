import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "./queryKeys";

export const USE_API_KEYS_DEPENDENCIES = {
  useUser
};

export type NewApiKey = { name: string; expiresAt: Date };

export function useUserApiKeys(
  options: Omit<UseQueryOptions<ApiKeyResponse[], Error, ApiKeyResponse[], QueryKey>, "queryKey" | "queryFn"> = {},
  dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES
) {
  const { user } = dependencies.useUser();
  const { apiKey } = useServices();

  return useQuery<ApiKeyResponse[], Error>({
    queryKey: QueryKeys.getApiKeysKey(user?.userId ?? ""),
    queryFn: async () => await apiKey.getApiKeys(),
    enabled: !!user?.userId,
    refetchInterval: 10_000,
    retry: failureCount => failureCount < 5,
    retryDelay: 10_000,
    ...options
  });
}

export function useCreateApiKey(dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES) {
  const { user } = dependencies.useUser();
  const queryClient = useQueryClient();
  const { apiKey } = useServices();

  return useMutation<ApiKeyResponse, Error, NewApiKey>({
    mutationFn: ({ name, expiresAt }) => apiKey.createApiKey({ data: { name, expiresAt } }),
    onSuccess: ({ apiKey: _secret, ...createdKey }) => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[] | undefined) => {
        if (!oldData) return [createdKey];
        return [...oldData, createdKey];
      });
    }
  });
}

export function useDeleteApiKey(id: string, onSuccess?: () => void, dependencies: typeof USE_API_KEYS_DEPENDENCIES = USE_API_KEYS_DEPENDENCIES) {
  const { user } = dependencies.useUser();
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
