import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { useIsMutating } from "@tanstack/react-query";
import { useAtom } from "jotai";

import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import walletStore from "@src/store/walletStore";
import { ensureUserManagedWalletOwnership, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useCustomUser } from "./useCustomUser";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { user: signedInUser } = useCustomUser();
  const { data: queried, isLoading: isInitialLoading, isFetching, refetch } = useManagedWalletQuery(user?.id);
  const {
    mutate: create,
    data: created,
    isPending: isCreating,
    isSuccess: isCreated,
    error: createError,
    reset: resetCreate
  } = useCreateManagedWalletMutation();
  // A trial wallet is often created from a different `useManagedWallet` instance (the onboarding picker /
  // auto-deploy flow) than the one that reads loading state (the persistent WalletProvider). Observing the
  // mutation cache — not just this observer's `isCreating` — makes the loading signal reflect an in-flight
  // create regardless of which instance fired it, so consumers (e.g. the onboarding redirect guard) don't
  // treat a provisioning trial as "no wallet" and bounce the user to /signup mid-provision.
  const isCreatingManagedWallet = useIsMutating({ mutationKey: QueryKeys.getManagedWalletCreateMutationKey() }) > 0;
  const wallet = useMemo(() => (queried || created) as ApiManagedWalletOutput, [queried, created]);
  const isLoading = isInitialLoading || isCreating || isCreatingManagedWallet;
  const [, setIsSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);

  useEffect(() => {
    if (signedInUser?.id && (!!queried || !!created)) {
      setIsSignedInWithTrial(true);
    }
  }, [signedInUser?.id, queried, created, setIsSignedInWithTrial]);

  useEffect(() => {
    if (wallet && isCreated) {
      updateStorageManagedWallet({ ...wallet, selected: true });
    } else if (wallet) {
      updateStorageManagedWallet(wallet);
    }
  }, [isCreated, wallet]);

  useEffect(() => {
    if (user?.id && !user.userId) {
      ensureUserManagedWalletOwnership(user.id);
    }
  }, [user]);

  return useMemo(() => {
    const isConfigured = !!wallet;
    return {
      create: () => {
        if (!user?.id) {
          throw new Error("User is not initialized yet");
        }

        create(user.id);
      },
      wallet: wallet
        ? {
            ...wallet,
            username: wallet.username,
            isWalletConnected: isConfigured,
            isWalletLoaded: isConfigured,
            selected: true
          }
        : undefined,
      isLoading,
      isFetching,
      createError,
      resetCreate,
      refetch
    };
  }, [wallet, isLoading, isFetching, createError, resetCreate, refetch, user?.id, create]);
};
