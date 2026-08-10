import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";

import { useUser } from "@src/hooks/useUser";
import { useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import { ensureUserManagedWalletOwnership, updateStorageManagedWallet } from "@src/utils/walletUtils";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { data: queried, isLoading: isInitialLoading, isFetching, refetch } = useManagedWalletQuery(user?.id);
  const wallet = queried as ApiManagedWalletOutput | undefined;

  useEffect(() => {
    if (!wallet) return;
    updateStorageManagedWallet(wallet);
  }, [wallet]);

  useEffect(() => {
    if (user?.id && !user.userId) {
      ensureUserManagedWalletOwnership(user.id);
    }
  }, [user]);

  return useMemo(() => {
    return {
      wallet: wallet || undefined,
      /**
       * True only during the initial wallet-existence lookup. Consumers gating on "do we yet know the user's
       * wallet situation?" (the wallet boot gate) use this so a provisioning trial reads as known identity and
       * doesn't blank the page with a full-screen loader.
       */
      isInitializing: isInitialLoading,
      isFetching,
      refetch
    };
  }, [wallet, isInitialLoading, isFetching, refetch]);
};
