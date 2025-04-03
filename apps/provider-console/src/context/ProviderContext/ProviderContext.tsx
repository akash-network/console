"use client";
import React, { useEffect } from "react";
import type { AxiosError } from "axios";

import { getSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { useProviderDashboard, useProviderDetails } from "@src/queries/useProviderQuery";
import type { ProviderDashoard, ProviderDetails } from "@src/types/provider";
import restClient from "@src/utils/restClient";
import { useWallet } from "../WalletProvider";

type ContextType = {
  providerDetails: ProviderDetails | null | undefined;
  providerDashboard: ProviderDashoard | null | undefined;
  isLoadingProviderDetails: boolean;
  isLoadingProviderDashboard: boolean;
};

const ProviderContext = React.createContext<ContextType>({} as ContextType);

export const ProviderContextProvider = ({ children }) => {
  const { address, isProviderStatusFetched, setIsWalletProvider, setIsProviderStatusFetched, setIsProviderOnlineStatusFetched, setIsWalletProviderOnline } =
    useWallet();
  const selectedNetwork = getSelectedNetwork();

  const { data: providerDetails, isLoading: isLoadingProviderDetails, error: providerError } = useProviderDetails(address);
  const { data: providerDashboard, isLoading: isLoadingProviderDashboard } = useProviderDashboard(address);

  useEffect(() => {
    const checkProviderStatus = async () => {
      if ((providerError as AxiosError)?.response?.status === 404) {
        setIsWalletProvider(false);
        setIsProviderStatusFetched(true);
        setIsProviderOnlineStatusFetched(true);
        return;
      }

      if (providerDetails) {
        setIsWalletProvider(true);
        setIsProviderStatusFetched(true);
        try {
          const isOnlineResponse: { online: boolean } = await restClient.get(`/provider/status/online?chainid=${selectedNetwork.chainId}`);
          setIsProviderOnlineStatusFetched(true);
          setIsWalletProviderOnline(isOnlineResponse.online);
        } catch (error) {
          console.error("Error fetching provider online status:", error);
        } finally {
          setIsProviderOnlineStatusFetched(true);
        }
      }
    };
    checkProviderStatus();
  }, [
    providerDetails,
    providerError,
    selectedNetwork.chainId,
    isProviderStatusFetched,
    setIsWalletProvider,
    setIsProviderStatusFetched,
    setIsProviderOnlineStatusFetched,
    setIsWalletProviderOnline
  ]);

  return (
    <ProviderContext.Provider
      value={{
        providerDetails,
        providerDashboard,
        isLoadingProviderDetails,
        isLoadingProviderDashboard
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export const useProvider = () => {
  return { ...React.useContext(ProviderContext) };
};
