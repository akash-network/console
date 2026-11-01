"use client";
import React, { useEffect, useState } from "react";

import { ApiUrlService } from "@src/utils/apiUtils";
import { useRootContainer } from "../ServicesProvider/RootContainerProvider";

/** A height the status endpoint reported and when it arrived, so readers can extrapolate the current height without asking for it. */
export type ObservedBlockHeight = {
  height: number;
  observedAt: number;
};

type ContextType = {
  isBlockchainDown: boolean;
  latestBlock: ObservedBlockHeight | null;
};

export type BlockchainStatusContextType = ContextType;

type BlockchainStatusResponse = {
  isBlockchainReachable: boolean;
  latestBlockHeight?: number | null;
};

export const BlockchainStatusContext = React.createContext<ContextType>({
  isBlockchainDown: false,
  latestBlock: null
});

// Match stats-web's useTopBanner polling cadence
const BLOCKCHAIN_STATUS_POLL_INTERVAL_MS = 5 * 60_000;

/**
 * The next poll is only scheduled once the current request settles, so a request that never settles
 * would stop polling for the rest of the session. The client sets no default timeout of its own.
 */
const BLOCKCHAIN_STATUS_REQUEST_TIMEOUT_MS = 30_000;

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
  const [status, setStatus] = useState<ContextType>({ isBlockchainDown: false, latestBlock: null });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let isCancelled = false;

    const pingBlockchainStatus = async () => {
      try {
        const { data } = await publicConsoleApiHttpClient.get<BlockchainStatusResponse>(ApiUrlService.blockchainStatus(), {
          timeout: BLOCKCHAIN_STATUS_REQUEST_TIMEOUT_MS
        });
        if (!isCancelled) {
          setStatus(previous => ({
            isBlockchainDown: !data.isBlockchainReachable,
            latestBlock: data.latestBlockHeight == null ? previous.latestBlock : { height: data.latestBlockHeight, observedAt: Date.now() }
          }));
        }
      } catch {
        if (!isCancelled) setStatus(previous => ({ ...previous, isBlockchainDown: true }));
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

  return <BlockchainStatusContext.Provider value={status}>{children}</BlockchainStatusContext.Provider>;
};

export const useBlockchainStatus = (): BlockchainStatusContextType => {
  return React.useContext(BlockchainStatusContext);
};
