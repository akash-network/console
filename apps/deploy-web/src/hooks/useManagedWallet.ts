import { useEffect, useMemo } from "react";
import { useAtom } from "jotai/index";

import { envConfig } from "@src/config/env.config";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { useCreateManagedWalletMutation, useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";
import networkStore from "@src/store/networkStore";
import { deleteManagedWalletFromStorage, updateStorageManagedWallet } from "@src/utils/walletUtils";

const isBillingEnabled = envConfig.NEXT_PUBLIC_BILLING_ENABLED;
const { NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID } = envConfig;

export const useManagedWallet = () => {
  const user = useUser();

  const { data: queried, isFetched, isLoading: isFetching, refetch } = useManagedWalletQuery(isBillingEnabled && user?.id);
  const { mutate: create, data: created, isLoading: isCreating, isSuccess: isCreated } = useCreateManagedWalletMutation();
  const wallet = useMemo(() => queried || created, [queried, created]);
  const isLoading = isFetching || isCreating;
  const [selectedNetworkId, setSelectedNetworkId] = useAtom(networkStore.selectedNetworkId);

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

  useWhen(created && NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID && selectedNetworkId !== NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID, () => {
    setSelectedNetworkId(NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID);
  });

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
