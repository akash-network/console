import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { useAtom } from "jotai";

import { useUser } from "@src/hooks/useUser";
import { useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import walletStore from "@src/store/walletStore";
import { ensureUserManagedWalletOwnership, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useCustomUser } from "./useCustomUser";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { user: signedInUser } = useCustomUser();
  const { data: queried, isLoading: isInitialLoading, isFetching, refetch } = useManagedWalletQuery(user?.id);
  const wallet = queried as ApiManagedWalletOutput | undefined;
  const [, setIsSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);

  useEffect(() => {
    if (signedInUser?.id && !!queried) {
      setIsSignedInWithTrial(true);
    }
  }, [signedInUser?.id, queried, setIsSignedInWithTrial]);

  useEffect(() => {
    if (!wallet?.address) {
      return;
    }

    updateStorageManagedWallet(wallet);
  }, [wallet]);

  useEffect(() => {
    if (user?.id && !user.userId) {
      ensureUserManagedWalletOwnership(user.id);
    }
  }, [user]);

  return useMemo(() => {
    const isConfigured = !!wallet;
    return {
      wallet: wallet
        ? {
            ...wallet,
            username: wallet.username,
            isWalletConnected: isConfigured,
            isWalletLoaded: isConfigured,
            selected: true
          }
        : undefined,
      isLoading: isInitialLoading,
      /**
       * True only during the initial wallet-existence lookup. Consumers gating on "do we yet know the user's
       * wallet situation?" (the onboarding gate) use this so a provisioning trial reads as known identity and
       * doesn't blank the page with a full-screen loader.
       */
      isInitializing: isInitialLoading,
      isFetching,
      refetch
    };
  }, [wallet, isInitialLoading, isFetching, refetch]);
};
