"use client";
import consoleClient from "@src/utils/consoleClient";
import React from "react";
import { useQuery } from "react-query";
import { useWallet } from "../WalletProvider";

type ContextType = {
  providerDetails: any;
  providerDashboard: any;
  isLoadingProviderDetails: boolean;
  isLoadingProviderDashboard: boolean;
};

const ProviderContext = React.createContext<ContextType>({} as ContextType);

export const ProviderContextProvider = ({ children }) => {
  const { address } = useWallet();

  const { data: providerDetails, isLoading: isLoadingProviderDetails } = useQuery(
    "providerDetails",
    () => consoleClient.get(`/v1/providers/${address}`),
    {
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: !!address
    }
  );

  const { data: providerDashboard, isLoading: isLoadingProviderDashboard } = useQuery(
    "providerDashboard",
    () => consoleClient.get(`/internal/provider-dashboard/${address}`),
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
