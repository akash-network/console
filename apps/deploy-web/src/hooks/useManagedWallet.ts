import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { useIsMutating } from "@tanstack/react-query";

import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import { ensureUserManagedWalletOwnership, updateStorageManagedWallet } from "@src/utils/walletUtils";

export const useManagedWallet = () => {
  const { user } = useUser();
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
  const isCreatingFromAnyInstance = isCreating || isCreatingManagedWallet;
  const isLoading = isInitialLoading || isCreatingFromAnyInstance;

  useEffect(() => {
    if (!wallet?.address) {
      return;
    }

    if (isCreated) {
      updateStorageManagedWallet({ ...wallet, selected: true });
    } else {
      updateStorageManagedWallet(wallet);
    }
  }, [isCreated, wallet]);

  useEffect(() => {
    if (user?.id && !user.userId) {
      ensureUserManagedWalletOwnership(user.id);
    }
  }, [user]);

  return useMemo(() => {
    return {
      create: () => {
        if (!user?.id) {
          throw new Error("User is not initialized yet");
        }

        create(user.id);
      },
      wallet: wallet || undefined,
      isLoading,
      /**
       * True while a trial wallet creation is in flight, regardless of which hook instance fired it.
       */
      isCreating: isCreatingFromAnyInstance,
      /**
       * True only during the initial wallet-existence lookup — never while a trial wallet is being created.
       * Consumers gating on "do we yet know the user's wallet situation?" (the wallet boot gate) use this so a
       * provisioning trial reads as known identity and doesn't blank the page with a full-screen loader.
       */
      isInitializing: isInitialLoading,
      isFetching,
      createError,
      resetCreate,
      refetch
    };
  }, [wallet, isLoading, isCreatingFromAnyInstance, isInitialLoading, isFetching, createError, resetCreate, refetch, user?.id, create]);
};
