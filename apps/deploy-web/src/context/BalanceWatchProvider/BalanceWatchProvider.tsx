"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { useWalletBalance } from "@src/hooks/useWalletBalance";

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 30000;
const MAX_ATTEMPTS = MAX_POLLING_DURATION_MS / POLLING_INTERVAL_MS;

export const DEPENDENCIES = {
  useWalletBalance
};

export interface BalanceWatchCallbacks {
  onSuccess?: () => void;
  onTimeOut?: () => void;
}

export interface BalanceWatchContextType {
  /** Start watching for a balance increase. Only one watch can be active at a time; calls while already active are no-ops. */
  start: (snapshotBalance: number, balanceKey?: keyof WalletBalance, callbacks?: BalanceWatchCallbacks) => void;
  stop: () => void;
  isActive: boolean;
  /** Becomes true once the polled balance exceeds the snapshot. Resets on next start. */
  isSuccess: boolean;
  /** True if polling timed out without detecting a change. Resets on next start. */
  isTimeOut: boolean;
}

interface ActivePoll {
  snapshotBalance: number;
  balanceKey: keyof WalletBalance;
  attemptCount: number;
  interval: ReturnType<typeof setInterval>;
  callbacks: BalanceWatchCallbacks | null;
}

const BalanceWatchContext = createContext<BalanceWatchContextType | null>(null);

export interface BalanceWatchProviderProps {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

export const BalanceWatchProvider: React.FC<BalanceWatchProviderProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { balance: currentBalance, refetch: refetchBalance } = d.useWalletBalance();

  const [isActive, setIsActive] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isTimeOut, setIsTimeOut] = React.useState(false);

  const pollRef = useRef<ActivePoll | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current.interval);
      pollRef.current = null;
    }
    setIsActive(false);
  }, []);

  const start = useCallback(
    (snapshotBalance: number, balanceKey: keyof WalletBalance = "totalUsd", callbacks?: BalanceWatchCallbacks) => {
      if (pollRef.current) {
        return;
      }

      setIsActive(true);
      setIsSuccess(false);
      setIsTimeOut(false);

      refetchBalance();

      pollRef.current = {
        snapshotBalance,
        balanceKey,
        attemptCount: 0,
        callbacks: callbacks ?? null,
        interval: setInterval(() => {
          if (!pollRef.current) {
            return;
          }

          pollRef.current.attemptCount++;

          if (pollRef.current.attemptCount >= MAX_ATTEMPTS) {
            setIsTimeOut(true);
            pollRef.current.callbacks?.onTimeOut?.();
            clearInterval(pollRef.current.interval);
            pollRef.current = null;
            setIsActive(false);
            return;
          }

          refetchBalance();
        }, POLLING_INTERVAL_MS)
      };
    },
    [refetchBalance]
  );

  useEffect(
    function checkBalanceChange() {
      if (!isActive || !currentBalance || !pollRef.current) {
        return;
      }

      if (currentBalance[pollRef.current.balanceKey] > pollRef.current.snapshotBalance) {
        setIsSuccess(true);
        pollRef.current.callbacks?.onSuccess?.();
        stop();
      }
    },
    [isActive, currentBalance, stop]
  );

  useEffect(
    function stopOnUnmount() {
      return () => {
        stop();
      };
    },
    [stop]
  );

  const contextValue: BalanceWatchContextType = {
    start,
    stop,
    isActive,
    isSuccess,
    isTimeOut
  };

  return <BalanceWatchContext.Provider value={contextValue}>{children}</BalanceWatchContext.Provider>;
};

export const useBalanceWatch = (): BalanceWatchContextType => {
  const context = useContext(BalanceWatchContext);
  if (!context) {
    throw new Error("useBalanceWatch must be used within a BalanceWatchProvider");
  }
  return context;
};
