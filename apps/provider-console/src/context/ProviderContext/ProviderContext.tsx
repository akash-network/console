"use client";
import React from "react";

import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { useProviderDashboard, useProviderDetails, useProviderOnlineStatus } from "@src/queries/useProviderQuery";
import type { ProviderDashoard, ProviderDetails } from "@src/types/provider";
import { useWallet } from "../WalletProvider";

type ContextType = {
  providerDetails: ProviderDetails | null | undefined;
  providerDashboard: ProviderDashoard | null | undefined;
  isLoadingProviderDetails: boolean;
  isLoadingProviderDashboard: boolean;
  isLoadingOnlineStatus: boolean;
  isOnline: boolean | undefined;
  providerError: Error | null;
  providerDashboardError: Error | null;
  onlineError: Error | null;
};

const ProviderContext = React.createContext<ContextType>({} as ContextType);

export const ProviderContextProvider = ({ children }) => {
  const { address } = useWallet();
  const selectedNetwork = getSelectedNetwork();

  const { data: providerDetails, isLoading: isLoadingProviderDetails, error: providerError } = useProviderDetails(address);
  const { data: providerDashboard, isLoading: isLoadingProviderDashboard, error: providerDashboardError } = useProviderDashboard(address);
  const {
    data: isOnline,
    isLoading: isLoadingOnlineStatus,
    error: onlineError
  } = useProviderOnlineStatus(providerDetails?.hostUri, selectedNetwork.chainId, !!providerDetails);

  return (
    <ProviderContext.Provider
      value={{
        providerDetails,
        providerDashboard,
        isLoadingProviderDetails,
        isLoadingProviderDashboard,
        isLoadingOnlineStatus,
        isOnline: isOnline ?? undefined,
        providerError,
        providerDashboardError,
        onlineError
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export const useProvider = () => {
  return { ...React.useContext(ProviderContext) };
};
