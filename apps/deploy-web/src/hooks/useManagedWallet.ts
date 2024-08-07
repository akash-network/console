import { useEffect, useMemo } from "react";

import { envConfig } from "@src/config/env.config";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import { deleteManagedWalletFromStorage, updateStorageManagedWallet } from "@src/utils/walletUtils";

const isBillingEnabled = envConfig.NEXT_PUBLIC_BILLING_ENABLED;

export const useManagedWallet = () => {
  const { user: registeredUser } = useCustomUser();
  const { user: anonymousUser } = useStoredAnonymousUser();
  const user = useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);

  const { data: queried, isFetched, isLoading: isFetching, refetch } = useManagedWalletQuery(isBillingEnabled && user?.id);
  const { mutate: create, data: created, isLoading: isCreating, isSuccess: isCreated } = useCreateManagedWalletMutation();
  const wallet = useMemo(() => queried || created, [queried, created]);
  const isLoading = isFetching || isCreating;

  useEffect(() => {
    if (!isBillingEnabled) {
      return;
    }

    if (isFetched && isCreated && !wallet) {
      deleteManagedWalletFromStorage();
    } else if (wallet) {
      updateStorageManagedWallet(wallet);
    }
  }, [isFetched, isCreated, wallet]);

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
            isWalletConnected: isConfigured,
            isWalletLoaded: isConfigured
          }
        : undefined,
      isLoading,
      refetch
    };
  }, [create, isLoading, user?.id, wallet, refetch]);
};
