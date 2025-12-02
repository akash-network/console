import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { useAtom } from "jotai";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useUser } from "@src/hooks/useUser";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import walletStore from "@src/store/walletStore";
import { ensureUserManagedWalletOwnership, getSelectedStorageWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useCustomUser } from "./useCustomUser";

const { NEXT_PUBLIC_BILLING_ENABLED } = browserEnvConfig;
const isBillingEnabled = NEXT_PUBLIC_BILLING_ENABLED;

export const useManagedWallet = () => {
  const { user } = useUser();
  const { user: signedInUser } = useCustomUser();
  const userWallet = useSelectedChain();
  const [selectedWalletType, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const { data: queried, isLoading: isInitialLoading, isFetching, refetch } = useManagedWalletQuery(isBillingEnabled ? user?.id : undefined);
  const { mutate: create, data: created, isPending: isCreating, isSuccess: isCreated, error: createError } = useCreateManagedWalletMutation();
  const wallet = useMemo(() => (queried || created) as ApiManagedWalletOutput, [queried, created]);
  const isLoading = isInitialLoading || isCreating;
  const [, setIsSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const selected = getSelectedStorageWallet();

  useEffect(() => {
    if (selectedWalletType === "custodial" && queried && !userWallet.isWalletConnected && !userWallet.isWalletConnecting) {
      setSelectedWalletType("managed");
    }
  }, [queried, selectedWalletType, setSelectedWalletType, userWallet.isWalletConnected, userWallet.isWalletConnecting]);

  useEffect(() => {
    if (signedInUser?.id && (!!queried || !!created)) {
      setIsSignedInWithTrial(true);
    }
  }, [signedInUser?.id, queried, created, setIsSignedInWithTrial]);

  useEffect(() => {
    if (!isBillingEnabled) {
      return;
    }

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
      isFetching,
      createError,
      refetch
    };
  }, [wallet, selected?.address, isLoading, isFetching, createError, refetch, user?.id, create]);
};
