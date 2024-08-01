import { useMutation, useQuery, useQueryClient } from "react-query";

import { managedWalletHttpService } from "@src/services/http/http.service";

const MANAGED_WALLET = "MANAGED_WALLET";

export function useManagedWalletQuery(userId?: string) {
  return useQuery(
    [MANAGED_WALLET, userId],
    async () => {
      if (userId) {
        return await managedWalletHttpService.getWallet(userId);
      }
    },
    {
      enabled: !!userId,
      staleTime: Infinity
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
