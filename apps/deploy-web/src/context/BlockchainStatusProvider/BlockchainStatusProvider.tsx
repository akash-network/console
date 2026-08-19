"use client";
import React, { useEffect, useState } from "react";

import { ApiUrlService } from "@src/utils/apiUtils";
import { useRootContainer } from "../ServicesProvider/RootContainerProvider";

type ContextType = {
  isBlockchainDown: boolean;
  setIsBlockchainDown: (isBlockchainDown: boolean) => void;
};

export type BlockchainStatusContextType = ContextType;

export const BlockchainStatusContext = React.createContext<ContextType>({
  isBlockchainDown: false,
  setIsBlockchainDown: () => {}
});

// Match stats-web's useTopBanner polling cadence
const BLOCKCHAIN_STATUS_POLL_INTERVAL_MS = 5 * 60_000;

export const DEPENDENCIES = {
  useRootContainer
};

type Props = {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Managed wallets never talk to RPC nodes directly: chain calls go through the backend proxy, so
 * reachability is polled from our own API rather than from a browser-side list of RPC nodes.
 */
export const BlockchainStatusProvider: React.FC<Props> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { publicConsoleApiHttpClient } = d.useRootContainer();
  const [isBlockchainDown, setIsBlockchainDown] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let isCancelled = false;

    const pingBlockchainStatus = async () => {
      try {
        const { data } = await publicConsoleApiHttpClient.get<{ isBlockchainReachable: boolean }>(ApiUrlService.blockchainStatus());
        if (!isCancelled) setIsBlockchainDown(!data.isBlockchainReachable);
      } catch {
        if (!isCancelled) setIsBlockchainDown(true);
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

  const value = React.useMemo(() => ({ isBlockchainDown, setIsBlockchainDown }), [isBlockchainDown]);

  return <BlockchainStatusContext.Provider value={value}>{children}</BlockchainStatusContext.Provider>;
};

export const useBlockchainStatus = (): BlockchainStatusContextType => {
  return React.useContext(BlockchainStatusContext);
};
