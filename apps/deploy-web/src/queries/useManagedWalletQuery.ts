import { useMutation, useQuery } from "react-query";

import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

export function useManagedWalletQuery(userId?: string) {
  return useQuery(["FiatWallet", userId], async () => (userId ? await managedWalletHttpService.getWallet(userId) : undefined), { enabled: !!userId });
}

export function useCreateManagedWalletMutation(userId?: string) {
  return useMutation(["FiatWallet", userId], async () => (userId ? await managedWalletHttpService.createWallet(userId) : undefined));
}
