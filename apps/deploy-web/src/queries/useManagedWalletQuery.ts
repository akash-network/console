import { QueryKey, useMutation, useQuery, useQueryClient, UseQueryOptions } from "react-query";
import { ApiWalletOutput } from "@akashnetwork/http-sdk";

import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

const MANAGED_WALLET = "MANAGED_WALLET";

export function useManagedWalletQuery(userId?: string, options?: Omit<UseQueryOptions<ApiWalletOutput, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery(
    [MANAGED_WALLET, userId],
    async () => {
      if (userId) {
        return await managedWalletHttpService.getWallet(userId);
      }
    },
    {
      enabled: !!userId,
      staleTime: Infinity,
      ...options
    }
  );
}

export function useCreateManagedWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation(async (userId: string) => await managedWalletHttpService.createWallet(userId), {
    onSuccess: response => {
      queryClient.setQueryData([MANAGED_WALLET, response.userId], () => response);
    }
  });
}
