import { useMutation, useQuery, useQueryClient } from "react-query";
import { QueryKey, UseQueryOptions } from "react-query";
import axios from "axios";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { IApiKey } from "@src/types/apiKeys";
import { QueryKeys } from "./queryKeys";

export function useUserApiKeys(options: Omit<UseQueryOptions<IApiKey[], Error, any, QueryKey>, "queryKey" | "queryFn"> = {}) {
  const user = useUser();
  const { isTrialing } = useWallet();

  return useQuery<IApiKey[], Error>(
    QueryKeys.getApiKeysKey(user?.userId ?? ""),
    async () => {
      const response = await axios.get(`/api/proxy/v1/api-keys`);

      return response.data.data;
    },
    {
      enabled: !!user?.userId && !isTrialing,
      refetchInterval: 10000,
      retry: 5,
      ...options
    }
  );
}

export function useCreateApiKey() {
  const user = useUser();
  const queryClient = useQueryClient();

  return useMutation<{ data: { data: IApiKey } }, Error, string>(
    (name: string) =>
      axios.post("/api/proxy/v1/api-keys", {
        data: {
          name: name
        }
      }),
    {
      onSuccess: _response => {
        queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: IApiKey[]) => {
          return [...oldData, _response.data.data];
        });
      }
    }
  );
}

export function useDeleteApiKey(id: string, onSuccess?: () => void) {
  const user = useUser();
  const queryClient = useQueryClient();

  return useMutation(() => axios.delete(`/api/proxy/v1/api-keys/${id}`), {
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getApiKeysKey(user?.userId ?? ""), (oldData: IApiKey[] = []) => {
        return oldData.filter(t => t.id !== id);
      });
      onSuccess?.();
    }
  });
}
