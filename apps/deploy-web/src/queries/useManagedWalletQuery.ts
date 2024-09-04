import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

const MANAGED_WALLET = "MANAGED_WALLET";

export function useManagedWalletQuery(userId?: string) {
  return useQuery({
    queryKey: [MANAGED_WALLET, userId],
    queryFn: async () => {
      if (userId) {
        return await managedWalletHttpService.getWallet(userId);
      }
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}

export function useCreateManagedWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => await managedWalletHttpService.createWallet(userId),
    onSuccess: (response) => {
      queryClient.setQueryData([MANAGED_WALLET, response.userId], () => response);
    },
  });
}