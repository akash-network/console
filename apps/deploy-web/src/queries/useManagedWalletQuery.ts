import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

const MANAGED_WALLET = "MANAGED_WALLET";

export function useManagedWalletQuery(userId?: string) {
  const { managedWalletService } = useServices();
  return useQuery({
    queryKey: [MANAGED_WALLET, userId || ""] as QueryKey,
    queryFn: async () => {
      if (userId) {
        return await managedWalletService.getWallet(userId);
      }
      return null;
    },
    enabled: !!userId,
    staleTime: Infinity
  });
}

export function useCreateManagedWalletMutation() {
  const { managedWalletService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => await managedWalletService.createWallet(userId),
    onSuccess: response => {
      queryClient.setQueryData([MANAGED_WALLET, response.userId], () => response);
    }
  });
}
