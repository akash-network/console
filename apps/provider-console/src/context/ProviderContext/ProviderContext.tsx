"use client";
import React from "react";
import { useQuery } from "react-query";

import { ProviderDashoard, ProviderDetails } from "@src/types/provider";
import consoleClient from "@src/utils/consoleClient";
import { useWallet } from "../WalletProvider";

type ContextType = {
  providerDetails: ProviderDetails | null | undefined;
  providerDashboard: ProviderDashoard | null | undefined;
  isLoadingProviderDetails: boolean;
  isLoadingProviderDashboard: boolean;
};

const ProviderContext = React.createContext<ContextType>({} as ContextType);

export const ProviderContextProvider = ({ children }) => {
  const { address } = useWallet();

  const { data: providerDetails, isLoading: isLoadingProviderDetails } = useQuery<ProviderDetails | null>(
    ["providerDetails", address],
    async () => {
      try {
        return await consoleClient.get<ProviderDetails, ProviderDetails>(`/v1/providers/${address}`);
      } catch (error) {
        if (error.response?.status === 404) {
          return null; // Return null for non-existent providers
        }
        throw error;
      }
    },
    {
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: !!address
    }
  );

  const { data: providerDashboard, isLoading: isLoadingProviderDashboard } = useQuery<ProviderDashoard | null>(
    ["providerDashboard", address],
    async () => {
      try {
        return await consoleClient.get(`/internal/provider-dashboard/${address}`);
      } catch (error) {
        if (error.response?.status === 404) {
          return null; // Return null for non-existent dashboard data
        }
        throw error; // Re-throw other errors
      }
    },
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
