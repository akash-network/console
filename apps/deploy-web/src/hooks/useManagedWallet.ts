import { useEffect, useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { useAtom } from "jotai";

import { useUser } from "@src/hooks/useUser";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import walletStore from "@src/store/walletStore";
import { ensureUserManagedWalletOwnership, getSelectedStorageWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useCustomUser } from "./useCustomUser";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { user: signedInUser } = useCustomUser();
  const [selectedWalletType, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const { data: queried, isLoading: isInitialLoading, isFetching, refetch } = useManagedWalletQuery(user?.id);
  const { mutate: create, data: created, isPending: isCreating, isSuccess: isCreated, error: createError } = useCreateManagedWalletMutation();
  const wallet = useMemo(() => (queried || created) as ApiManagedWalletOutput, [queried, created]);
  const isLoading = isInitialLoading || isCreating;
  const [, setIsSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const selected = getSelectedStorageWallet();

  useEffect(() => {
    if (selectedWalletType === "custodial" && queried) {
      setSelectedWalletType("managed");
    }
  }, [queried, selectedWalletType, setSelectedWalletType]);

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
