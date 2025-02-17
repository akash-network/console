import { useMutation, useQuery, useQueryClient } from "react-query";
import { QueryKey, UseQueryOptions } from "react-query";
import { ApiKeyResponse } from "@akashnetwork/http-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "./queryKeys";

export function useUserApiKeys(options: Omit<UseQueryOptions<ApiKeyResponse[], Error, any, QueryKey>, "queryKey" | "queryFn"> = {}) {
  const user = useUser();
  const { isTrialing } = useWallet();
  const { apiKey } = useServices();

  return useQuery<ApiKeyResponse[], Error>(QueryKeys.getApiKeysKey(user?.userId ?? ""), async () => await apiKey.getApiKeys(), {
    enabled: !!user?.userId && !isTrialing,
    refetchInterval: 10000,
    retry: 5,
    ...options
  });
}

export function useCreateApiKey() {
  const user = useUser();
  const queryClient = useQueryClient();
  const { apiKey } = useServices();

  return useMutation<ApiKeyResponse, Error, string>(
    (name: string) =>
      apiKey.createApiKey({
        data: {
          name: name
        }
      }),
    {
      onSuccess: _response => {
        queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[]) => {
          return [...oldData, _response];
        });
      }
    }
  );
}

export function useDeleteApiKey(id: string, onSuccess?: () => void) {
  const user = useUser();
  const queryClient = useQueryClient();
  const { apiKey } = useServices();

  return useMutation(() => apiKey.deleteApiKey(id), {
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[] = []) => {
        return oldData.filter(t => t.id !== id);
      });
      onSuccess?.();
    }
  });
}
