"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { TransactionModal } from "@src/components/layout/TransactionModal";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useSelectedChain } from "@src/hooks/useSelectedChain/useSelectedChain";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import { CURRENT_WALLET_KEY, useManager } from "@src/lib/cosmos-kit-jotai";
import { useBalances } from "@src/queries/useBalancesQuery";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";
import type { AppError } from "@src/types";
import { getStorageWallets, updateStorageWallets } from "@src/utils/walletUtils";
import { useServices } from "../ServicesProvider";
import { useSettings } from "../SettingsProvider";
import { settingsIdAtom } from "../SettingsProvider/settingsStore";
import { deriveWalletIsLoading } from "./deriveWalletIsLoading";
import { useSignAndBroadcast } from "./useSignAndBroadcast";

type ManagedWalletMarker =
  | {
      isManaged: true;
      denom: string;
    }
  | {
      isManaged: false;
      denom: undefined;
    };

export type ContextType = {
  address: string;
  walletName: string;
  isWalletConnected: boolean;
  isWalletLoaded: boolean;
  connectManagedWallet: () => void;
  logout: () => void;
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  isCustodial: boolean;
  isWalletLoading: boolean;
  isTrialing: boolean;
  isOnboarding: boolean;
  creditAmount?: number;
  topUpMinAmountUsd: number;
  hasManagedWallet: boolean;
  managedWalletError?: AppError;
} & ManagedWalletMarker;

/**
 * @private for testing only
 */
export const WalletProviderContext = React.createContext<ContextType>({} as ContextType);

/**
 * WalletProvider is a client only component
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { analyticsService, publicConfig: appConfig, urlService, windowLocation } = useServices();

  const [, setSettingsId] = useAtom(settingsIdAtom);
  const [isWalletLoaded, setIsWalletLoaded] = useState<boolean>(true);
  const router = useRouter();
  const { settings } = useSettings();
  const { user } = useUser();
  const userWallet = useSelectedChain();
  const { wallet: managedWallet, isLoading: isManagedWalletLoading, create: createManagedWallet, createError: managedWalletError } = useManagedWallet();
  const [selectedWalletType, setSelectedWalletType] = useAtom(walletStore.selectedWalletType);
  const {
    address: walletAddress,
    username,
    isWalletConnected
  } = useMemo(() => (selectedWalletType === "managed" && managedWallet) || userWallet, [managedWallet, userWallet, selectedWalletType]);
  const { refetch: refetchBalances } = useBalances(walletAddress);
  const custodialWalletManager = useManager();
  const managedMarker = useMemo((): ManagedWalletMarker => {
    if (!!managedWallet && managedWallet?.address === walletAddress) {
      return { isManaged: true, denom: managedWallet.denom };
    }

    return { isManaged: false, denom: undefined };
  }, [walletAddress, managedWallet]);
  const { isManaged } = managedMarker;
  const [selectedNetworkId, setSelectedNetworkId] = networkStore.useSelectedNetworkIdStore();
  const isLoading = deriveWalletIsLoading({
    hasAuthenticatedUserId: !!user?.userId,
    selectedWalletType,
    isManagedWalletLoading,
    isCustodialConnecting: userWallet.isWalletConnecting
  });
  const { signAndBroadcastTx, loadingState } = useSignAndBroadcast({ refetchBalances });

  useWhen(walletAddress, loadWallet);

  useWhen(isWalletConnected && selectedWalletType, () => {
    if (selectedWalletType === "custodial") {
      analyticsService.track(
        "connect_wallet",
        {
          category: "wallet",
          label: "Connect wallet"
        },
        "GA"
      );
      analyticsService.identify({ custodialWallet: true });
      analyticsService.trackSwitch("connect_wallet", "custodial", "Amplitude");
    } else if (selectedWalletType === "managed") {
      analyticsService.identify({ managedWallet: true });
      analyticsService.trackSwitch("connect_wallet", "managed", "Amplitude");
    }
  });

  useEffect(() => {
    if (!settings.apiEndpoint || !settings.rpcEndpoint) return;

    custodialWalletManager?.addEndpoints({
      akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
      "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
    });
  }, [custodialWalletManager, settings.apiEndpoint, settings.rpcEndpoint]);

  useEffect(() => {
    setSettingsId(walletAddress || null);
  }, [walletAddress]);

  /**
   * Force every visitor onto the managed-wallet network on first load, regardless of `selectedWalletType`.
   *
   * Why unconditional: in the onboarding redesign, every authenticated user gets a managed trial wallet,
   * and the entire console experience targets that network. Previously this effect only fired when
   * `selectedWalletType === "managed"`, which meant the switch happened *after* `useManagedWallet`
   * auto-flipped the wallet type — i.e. mid-deploy if the trial creation completed during a deploy —
   * tearing down in-flight requests. Firing on first load instead means the (one-time) reload happens
   * before any user action.
   *
   * Why `reload()` not `href = home`: a hard nav to `/` was sending the user back to home after a
   * successful deploy if the wallet-type flip happened post-success. Reloading in place keeps the URL.
   *
   * The localStorage-backed atom makes this a single reload per browser — subsequent loads see the
   * managed network already selected and skip the effect entirely.
   */
  useEffect(() => {
    if (selectedNetworkId === appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID) return;
    setSelectedNetworkId(appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID);
    windowLocation.reload();
  }, [selectedNetworkId, appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID, setSelectedNetworkId, windowLocation]);

  function connectManagedWallet() {
    if (!managedWallet) {
      createManagedWallet();
    }
    setSelectedWalletType("managed");
  }

  function logout() {
    userWallet.disconnect();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    }

    analyticsService.track("disconnect_wallet", {
      category: "wallet",
      label: "Disconnect wallet"
    });

    router.push(urlService.home());

    if (managedWallet) {
      setSelectedWalletType("managed");
    }
  }

  async function loadWallet(): Promise<void> {
    const networkId =
      isManaged && selectedNetworkId !== appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID ? appConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID : undefined;
    let currentWallets = getStorageWallets(networkId);

    if (!currentWallets.some(x => x.address === walletAddress)) {
      currentWallets = [...currentWallets, { name: username || "", address: walletAddress as string, selected: true, isManaged: false }];
    }

    currentWallets = currentWallets.map(x => ({ ...x, selected: x.address === walletAddress }));

    updateStorageWallets(currentWallets, networkId);

    setIsWalletLoaded(true);

    if (networkId) {
      setSelectedNetworkId(networkId);
    }
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
        isCustodial: !isManaged,
        isWalletLoading: isLoading,
        isTrialing: isManaged && !!managedWallet?.isTrialing,
        isOnboarding: !!user?.userId && isManaged && !!managedWallet?.isTrialing,
        creditAmount: isManaged ? managedWallet?.creditAmount : 0,
        topUpMinAmountUsd: managedWallet?.topUpMinAmountUsd ?? 20,
        hasManagedWallet: !!managedWallet,
        managedWalletError,
        ...managedMarker
      }}
    >
      {children}

      <TransactionModal state={loadingState} />
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
