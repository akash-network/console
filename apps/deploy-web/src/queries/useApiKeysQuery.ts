import { useMutation, useQuery, useQueryClient } from "react-query";
import { QueryKey, UseQueryOptions } from "react-query";
import { ApiKeyResponse } from "@akashnetwork/http-sdk";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { apiKeysHttpService } from "@src/services/api-keys/api-keys-http.service";
import { QueryKeys } from "./queryKeys";

export function useUserApiKeys(options: Omit<UseQueryOptions<ApiKeyResponse[], Error, any, QueryKey>, "queryKey" | "queryFn"> = {}) {
  const user = useUser();
  const { isTrialing } = useWallet();

  return useQuery<ApiKeyResponse[], Error>(QueryKeys.getApiKeysKey(user?.userId ?? ""), async () => await apiKeysHttpService.getApiKeys(), {
    enabled: !!user?.userId && !isTrialing,
    refetchInterval: 10000,
    retry: 5,
    ...options
  });
}

export function useCreateApiKey() {
  const user = useUser();
  const queryClient = useQueryClient();

  return useMutation<ApiKeyResponse, Error, string>(
    (name: string) =>
      apiKeysHttpService.createApiKey({
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

  return useMutation(() => apiKeysHttpService.deleteApiKey(id), {
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: ApiKeyResponse[] = []) => {
        return oldData.filter(t => t.id !== id);
      });
      onSuccess?.();
    }
  });
}
