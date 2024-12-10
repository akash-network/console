"use client";
import React from "react";
import { useQuery } from "react-query";

import { ProviderDashoard, ProviderDetails } from "@src/types/provider";
import consoleClient from "@src/utils/consoleClient";
import { useWallet } from "../WalletProvider";

type ContextType = {
  providerDetails: ProviderDetails | undefined;
  providerDashboard: ProviderDashoard | undefined;
  isLoadingProviderDetails: boolean;
  isLoadingProviderDashboard: boolean;
};

const ProviderContext = React.createContext<ContextType>({} as ContextType);

export const ProviderContextProvider = ({ children }) => {
  const { address } = useWallet();

  const { 
    data: providerDetails, 
    isLoading: isLoadingProviderDetails 
  } = useQuery<ProviderDetails>(
    "providerDetails", 
    async () => (await consoleClient.get(`/v1/providers/${address}`)).data,
    {
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: !!address
    }
  );

  const { data: providerDashboard, isLoading: isLoadingProviderDashboard } = useQuery<ProviderDashoard>(
    "providerDashboard",
    async () => (await consoleClient.get(`/internal/provider-dashboard/${address}`)),
    {
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: !!address
    }
  );

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
