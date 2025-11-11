import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export function useManagedWalletQuery(userId?: string) {
  const { managedWalletService } = useServices();
  return useQuery({
    queryKey: QueryKeys.getManagedWalletKey(userId) as QueryKey,
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
    mutationFn: async ({ userId }: { userId: string }) => await managedWalletService.createWallet(userId),
    onSuccess: response => {
      // Only update cache if it's a wallet response, not a 3D Secure response
      if (!response.requires3DS) {
        queryClient.setQueryData(QueryKeys.getManagedWalletKey(response.userId), () => response);
      }
    }
  });
}
