import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "./queryKeys";

export function useManagedWalletQuery(userId?: string) {
  const { consoleApi } = useServices();

  return consoleApi.v1.getWallets.useQuery(
    {
      query: {
        userId: userId ?? ""
      }
    },
    {
      select: response => response.data[0],
      enabled: !!userId,
      staleTime: Infinity
    }
  );
}

export function useCreateManagedWalletMutation() {
  const { managedWalletService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => await managedWalletService.createWallet(userId),
    onSuccess: response => {
      // Only update cache if it's a wallet response, not a 3D Secure response
      if (!response.requires3DS) {
        queryClient.setQueryData(QueryKeys.getManagedWalletKey(response.userId), () => response);
      }
    }
  });
}
