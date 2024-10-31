import { useEffect, useMemo } from "react";
import { useAtom } from "jotai";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import walletStore from "@src/store/walletStore";
import { deleteManagedWalletFromStorage, ensureUserManagedWalletOwnership, getSelectedStorageWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useCustomUser } from "./useCustomUser";

const { NEXT_PUBLIC_BILLING_ENABLED } = browserEnvConfig;
const isBillingEnabled = NEXT_PUBLIC_BILLING_ENABLED;

export const useManagedWallet = () => {
  const user = useUser();
  const { user: signedInUser } = useCustomUser();
  const { data: queried, isFetched, isLoading: isFetching, refetch } = useManagedWalletQuery(isBillingEnabled ? user?.id : undefined);
  const { mutate: create, data: created, isLoading: isCreating, isSuccess: isCreated } = useCreateManagedWalletMutation();
  const wallet = useMemo(() => queried || created, [queried, created]);
  const isLoading = isFetching || isCreating;
  const [, setIsSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const selected = getSelectedStorageWallet();

  useEffect(() => {
    if (signedInUser?.id && (!!queried || !!created)) {
      setIsSignedInWithTrial(true);
    }
  }, [signedInUser?.id, queried, created]);

  useEffect(() => {
    if (!isBillingEnabled) {
      return;
    }

    if (wallet && isCreated) {
      updateStorageManagedWallet({ ...wallet, selected: true });
    } else if (isFetched && !wallet) {
      deleteManagedWalletFromStorage();
    } else if (wallet) {
      updateStorageManagedWallet(wallet);
    }
  }, [isFetched, isCreated, wallet]);

  useEffect(() => {
    if (user?.id && !user.userId) {
      ensureUserManagedWalletOwnership(user.id);
    }
  }, [user]);

  return useMemo(() => {
    const isConfigured = !!wallet;
    return {
      create: () => {
        if (!isBillingEnabled) {
          throw new Error("Billing is not enabled");
        }

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
            selected: selected?.address === wallet.address
          }
        : undefined,
      isLoading,
      refetch
    };
  }, [create, isLoading, user?.id, wallet, refetch]);
};
