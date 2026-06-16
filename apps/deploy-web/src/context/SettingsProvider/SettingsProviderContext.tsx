"use client";
import React, { useEffect, useState } from "react";
import { netConfig } from "@akashnetwork/net";

import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { ApiUrlService } from "@src/utils/apiUtils";
import { migrateLocalStorage } from "@src/utils/localStorage";
import { useRootContainer } from "../ServicesProvider/RootContainerProvider";

export type Settings = {
  apiEndpoint: string;
  rpcEndpoint: string;
  isBlockchainDown: boolean;
};

type ContextType = {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  isLoadingSettings: boolean;
  isSettingsInit: boolean;
};

export type SettingsContextType = ContextType;

export const SettingsProviderContext = React.createContext<ContextType>({} as ContextType);

const defaultSettings: Settings = {
  apiEndpoint: "",
  rpcEndpoint: "",
  isBlockchainDown: false
};

// Match stats-web's useTopBanner polling cadence
const BLOCKCHAIN_STATUS_POLL_INTERVAL_MS = 5 * 60_000;

export const DEPENDENCIES = {
  useRootContainer,
  usePreviousRoute,
  migrateLocalStorage
};

type Props = {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const SettingsProvider: React.FC<Props> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { publicConsoleApiHttpClient, networkStore } = d.useRootContainer();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSettingsInit, setIsSettingsInit] = useState(false);
  const selectedNetwork = networkStore.useSelectedNetwork();
  const [{ isLoading: isLoadingNetworks }] = networkStore.useNetworksStore();

  d.usePreviousRoute();

  // Managed wallets never talk to RPC nodes directly: chain calls go through the backend proxy,
  // so the endpoints are static per network rather than picked from a polled node list.
  useEffect(() => {
    if (isLoadingNetworks) {
      return;
    }

    // Apply local storage migrations
    d.migrateLocalStorage();

    setSettings(prev => ({
      ...prev,
      apiEndpoint: netConfig.getBaseAPIUrl(selectedNetwork.id),
      rpcEndpoint: selectedNetwork.rpcEndpoint || netConfig.getBaseRpcUrl(selectedNetwork.id)
    }));
    setIsLoadingSettings(false);
    setIsSettingsInit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingNetworks, selectedNetwork.id]);

  // Poll the backend for blockchain reachability instead of polling RPC nodes from the browser.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let isCancelled = false;

    const pingBlockchainStatus = async () => {
      try {
        const { data } = await publicConsoleApiHttpClient.get<{ isBlockchainReachable: boolean }>(ApiUrlService.blockchainStatus());
        if (!isCancelled) setSettings(prev => ({ ...prev, isBlockchainDown: !data.isBlockchainReachable }));
      } catch {
        if (!isCancelled) setSettings(prev => ({ ...prev, isBlockchainDown: true }));
      } finally {
        if (!isCancelled) timeoutId = setTimeout(pingBlockchainStatus, BLOCKCHAIN_STATUS_POLL_INTERVAL_MS);
      }
    };

    pingBlockchainStatus();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [publicConsoleApiHttpClient]);

  return (
    <SettingsProviderContext.Provider
      value={{
        settings,
        setSettings,
        isLoadingSettings,
        isSettingsInit
      }}
    >
      {children}
    </SettingsProviderContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  return { ...React.useContext(SettingsProviderContext) };
};
