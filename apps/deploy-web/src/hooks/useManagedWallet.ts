import { useMemo } from "react";

import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import { useWhen } from "@src/hooks/useWhen";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import { updateStorageManagedWallet } from "@src/utils/walletUtils";

export const useManagedWallet = () => {
  const { user } = useStoredAnonymousUser();

  const queried = useManagedWalletQuery(user?.id);
  const created = useCreateManagedWalletMutation(user?.id);
  const wallet = useMemo(() => created.data || queried.data, [created.data, queried.data]);

  useWhen(wallet, () => {
    if (wallet) {
      updateStorageManagedWallet(wallet);
    }
  });

  return useMemo(() => {
    const isConfigured = !!wallet;
    return {
      create: created.mutate,
      wallet: wallet
        ? {
            ...wallet,
            isWalletConnected: isConfigured,
            isWalletLoaded: isConfigured
          }
        : undefined,
      isLoadingQuery: queried.isLoading
    };
  }, [wallet, created.mutate, queried.isLoading]);
};
