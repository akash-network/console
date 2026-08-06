"use client";
import React, { useEffect, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { useBalances } from "@src/queries/useBalancesQuery";
import type { AppError } from "@src/types";
import { getStorageManagedWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { BootLoading } from "../BootLoadingProvider/BootLoadingProvider";
import { useServices } from "../ServicesProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";
import { deriveWalletIsLoading } from "./deriveWalletIsLoading";
import { useSignAndBroadcast } from "./useSignAndBroadcast";

export const DEPENDENCIES = {
  useUser,
  useManagedWallet,
  useBalances,
  useSignAndBroadcast,
  useServices,
  useRouter,
  TransactionModal,
  BootLoading
};

export type ContextType = {
  address: string;
  walletName: string;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectManagedWallet: () => void;
  logout: () => void;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  isManaged: true;
  denom: string;
  isWalletLoading: boolean;
  /** True only during the initial wallet-existence lookup, not while a trial is being provisioned. */
  isWalletInitializing: boolean;
  isTrialing: boolean;
  isOnboarding: boolean;
  creditAmount?: number;
  topUpMinAmountUsd: number;
  hasManagedWallet: boolean;
  managedWalletError?: AppError;
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
  const { analyticsService, publicConfig: appConfig, urlService } = d.useServices();

  const [, setSettingsId] = useAtom(settingsIdAtom);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const router = d.useRouter();
  const { user } = d.useUser();
  const {
    wallet: managedWallet,
    isLoading: isManagedWalletLoading,
    isInitializing: isManagedWalletInitializing,
    create: createManagedWallet,
    createError: managedWalletError
  } = d.useManagedWallet();
  const walletAddress = managedWallet?.address;
  const username = managedWallet?.username;
  const isWalletConnected = !!managedWallet?.isWalletConnected;
  const { refetch: refetchBalances } = d.useBalances(walletAddress);
  const isLoading = deriveWalletIsLoading({
    hasAuthenticatedUserId: !!user?.userId,
    isManagedWalletLoading
  });
  const isInitializing = deriveWalletIsLoading({
    hasAuthenticatedUserId: !!user?.userId,
    isManagedWalletLoading: isManagedWalletInitializing
  });
  const { signAndBroadcastTx, loadingState } = d.useSignAndBroadcast({ refetchBalances });

  useWhen(walletAddress, loadWallet);

  useWhen(isWalletConnected, () => {
    analyticsService.identify({ managedWallet: true });
    analyticsService.trackSwitch("connect_wallet", "managed", "Amplitude");
  });

  useEffect(() => {
    setSettingsId(walletAddress || null);
  }, [walletAddress, setSettingsId]);

  function connectManagedWallet() {
    if (!managedWallet) {
      createManagedWallet();
    }
  }

  function logout() {
    analyticsService.track("disconnect_wallet", {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(urlService.home());
  }

  async function loadWallet(): Promise<void> {
    if (!managedWallet?.userId || !walletAddress) {
      setIsWalletLoaded(true);
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

    setIsWalletLoaded(true);
  }

  return (
    <WalletProviderContext.Provider
      value={{
        address: walletAddress as string,
        walletName: username as string,
        isWalletConnected,
        isWalletLoaded,
        connectManagedWallet,
        logout,
        signAndBroadcastTx,
        isManaged: true,
        denom: managedWallet?.denom ?? "",
        isWalletLoading: isLoading,
        isWalletInitializing: isInitializing,
        isTrialing: !!managedWallet?.isTrialing,
        isOnboarding: !!user?.userId && !!managedWallet?.isTrialing,
        creditAmount: managedWallet?.creditAmount,
        topUpMinAmountUsd: managedWallet?.topUpMinAmountUsd ?? 20,
        hasManagedWallet: !!managedWallet,
        managedWalletError
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

export function useIsManagedWalletUser() {
  const { isManaged: canVisit, isWalletLoading: isLoading } = useWallet();

  return { canVisit, isLoading };
}
