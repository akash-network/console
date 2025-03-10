import { ApiWalletOutput } from "@akashnetwork/http-sdk";
import { QueryKey, useMutation, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";

import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

const MANAGED_WALLET = "MANAGED_WALLET";

export function useManagedWalletQuery(userId?: string, options?: Omit<UseQueryOptions<ApiWalletOutput, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: [MANAGED_WALLET, userId],
    queryFn: async () => {
      if (userId) {
        const wallet = await managedWalletHttpService.getWallet(userId);

        return wallet || null;
      }
    },
    enabled: !!userId,
    staleTime: Infinity,
    ...options
  });
}

export function useCreateManagedWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => await managedWalletHttpService.createWallet(userId),
    onSuccess: response => {
      queryClient.setQueryData([MANAGED_WALLET, response.userId], () => response);
    }
  });
}
