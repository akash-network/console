"use client";
import React, { useEffect } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useAtom } from "jotai";

import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { useBalances } from "@src/queries/useBalancesQuery";
import { settingsIdAtom } from "@src/store/settingsStore";
import { getStorageManagedWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { BootLoading } from "../BootLoadingProvider/BootLoadingProvider";
import { useServices } from "../ServicesProvider";
import { deriveWalletIsLoading } from "./deriveWalletIsLoading";
import { useSignAndBroadcast } from "./useSignAndBroadcast";

export const DEPENDENCIES = {
  useUser,
  useManagedWallet,
  useBalances,
  useSignAndBroadcast,
  useServices,
  TransactionModal,
  BootLoading
};

export type ContextType = {
  address: string;
  /** True once the server-side wallet record exists. The address may still be empty while provisioning. */
  hasWallet: boolean;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  denom: string;
  isTrialing: boolean;
  creditAmount?: number;
  topUpMinAmountUsd: number;
};

/**
 * @private for testing only
 */
export const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

/**
 * WalletProvider is a client only component. It blocks rendering of its children behind the shared
 * boot overlay until the initial wallet-existence lookup settles, so consumers never observe an
 * unsettled wallet. The gate deliberately ignores wallet creation (trial provisioning) — gating on
 * it would blank the app mid-onboarding.
 */
export const WalletProvider: React.FC<{ children: React.ReactNode; dependencies?: typeof DEPENDENCIES }> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService, publicConfig: appConfig } = d.useServices();

  const [, setSettingsId] = useAtom(settingsIdAtom);
  const { user } = d.useUser();
  const { wallet: managedWallet, isInitializing: isManagedWalletInitializing } = d.useManagedWallet();
  const walletAddress = managedWallet?.address;
  const hasWallet = !!managedWallet;
  const { refetch: refetchBalances } = d.useBalances(walletAddress);
  const isInitializing = deriveWalletIsLoading({
    hasAuthenticatedUserId: !!user?.userId,
    isManagedWalletLoading: isManagedWalletInitializing
  });
  const { signAndBroadcastTx, loadingState } = d.useSignAndBroadcast({ refetchBalances });

  useWhen(walletAddress, syncStorageWallet);

  useWhen(hasWallet, () => {
    analyticsService.identify({ managedWallet: true });
    analyticsService.trackSwitch("connect_wallet", "managed", "Amplitude");
  });

  useEffect(() => {
    setSettingsId(walletAddress || null);
  }, [walletAddress, setSettingsId]);

  function syncStorageWallet(): void {
    if (!managedWallet?.userId || !walletAddress) {
      return;
    }

    const networkId = appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
    const stored = getStorageManagedWallet(managedWallet.userId, networkId);

    if (!stored || stored.address !== walletAddress || !stored.selected) {
      updateStorageManagedWallet({
        address: walletAddress,
        userId: managedWallet.userId,
        creditAmount: managedWallet.creditAmount,
        isTrialing: managedWallet.isTrialing,
        selected: true
      });
    }
  }

  return (
    <WalletProviderContext.Provider
      value={{
        address: walletAddress as string,
        hasWallet,
        signAndBroadcastTx,
        denom: managedWallet?.denom ?? "",
        isTrialing: !!managedWallet?.isTrialing,
        creditAmount: managedWallet?.creditAmount,
        topUpMinAmountUsd: managedWallet?.topUpMinAmountUsd ?? 20
      }}
    >
      {isInitializing ? (
        <d.BootLoading />
      ) : (
        <>
          {children}

          <d.TransactionModal state={loadingState} />
        </>
      )}
    </WalletProviderContext.Provider>
  );
};

// Hook
export function useWallet() {
  return { ...React.useContext(WalletProviderContext) };
}
