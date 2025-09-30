"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useWalletBalance } from "@src/hooks/useWalletBalance";

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 30000;
const MAX_ATTEMPTS = MAX_POLLING_DURATION_MS / POLLING_INTERVAL_MS;

export const DEPENDENCIES = {
  useWallet,
  useWalletBalance,
  useManagedWallet,
  useServices,
  useSnackbar,
  Snackbar
};

export interface PaymentPollingContextType {
  /**
   * Start polling for balance updates after payment.
   */
  pollForPayment: (initialBalance?: number | null) => void;
  /**
   * Stop polling (optional - usually not needed)
   */
  stopPolling: () => void;
  /**
   * Whether currently polling
   */
  isPolling: boolean;
}

const PaymentPollingContext = createContext<PaymentPollingContextType | null>(null);

export interface PaymentPollingProviderProps {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

export const PaymentPollingProvider: React.FC<PaymentPollingProviderProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { isTrialing: wasTrialing } = d.useWallet();
  const { balance: currentBalance, refetch: refetchBalance, isLoading: isBalanceLoading } = d.useWalletBalance();
  const { refetch: refetchManagedWallet, isFetching: isManagedWalletFetching } = d.useManagedWallet();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();

  const [isPolling, setIsPolling] = React.useState(false);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const attemptCountRef = useRef<number>(0);
  const initialBalanceRef = useRef<number | null>(null);
  const wasTrialingRef = useRef<boolean>(wasTrialing);
  const initialTrialingRef = useRef<boolean>(wasTrialing);
  const loadingSnackbarKeyRef = useRef<string | number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    isPollingRef.current = false;
    attemptCountRef.current = 0;
    setIsPolling(false);
    initialBalanceRef.current = null;
    initialTrialingRef.current = wasTrialing;

    if (loadingSnackbarKeyRef.current) {
      closeSnackbar(loadingSnackbarKeyRef.current);
      loadingSnackbarKeyRef.current = null;
    }
  }, [closeSnackbar, wasTrialing]);

  const executePoll = useCallback(() => {
    attemptCountRef.current++;

    if (attemptCountRef.current > MAX_ATTEMPTS) {
      stopPolling();
      enqueueSnackbar(<d.Snackbar title="Payment processing timeout" subTitle="Please refresh the page to check your balance" iconVariant="warning" />, {
        variant: "warning"
      });
      return;
    }

    try {
      refetchBalance();
      refetchManagedWallet();
    } catch (error) {
      console.error("Error during polling:", error);
    }
  }, [stopPolling, enqueueSnackbar, refetchBalance, refetchManagedWallet, d]);

  const pollForPayment = useCallback(
    (initialBalance?: number | null) => {
      if (isPolling) {
        return;
      }

      const balanceToUse = initialBalance ?? currentBalance?.totalUsd ?? null;
      initialBalanceRef.current = balanceToUse;
      initialTrialingRef.current = wasTrialing;
      isPollingRef.current = true;
      attemptCountRef.current = 0;
      setIsPolling(true);

      const loadingSnackbarKey = enqueueSnackbar(<d.Snackbar title="Processing payment..." subTitle="Please wait while we update your balance" showLoading />, {
        variant: "info",
        autoHideDuration: null,
        persist: true
      });
      loadingSnackbarKeyRef.current = loadingSnackbarKey;

      // Start the first poll immediately
      executePoll();
    },
    [isPolling, currentBalance, executePoll, enqueueSnackbar, wasTrialing, d]
  );

  useEffect(
    function updateWasTrialingRef() {
      wasTrialingRef.current = wasTrialing;
    },
    [wasTrialing]
  );

  useEffect(
    function handleRefetchCompletion() {
      if (!isPolling) {
        return;
      }

      if (!isBalanceLoading && !isManagedWalletFetching) {
        // Schedule next poll if still polling
        if (isPollingRef.current) {
          // Clear any existing timeout to prevent multiple timers
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }

          pollingTimeoutRef.current = setTimeout(() => {
            if (isPollingRef.current) {
              executePoll();
            }
          }, POLLING_INTERVAL_MS);
        }
      }
    },
    [isPolling, isBalanceLoading, isManagedWalletFetching, executePoll]
  );

  useEffect(
    function checkForPaymentCompletion() {
      if (!isPolling || !currentBalance || initialBalanceRef.current == null) {
        return;
      }

      const currentTotalBalance = currentBalance.totalUsd;
      const initialBalanceValue = initialBalanceRef.current;

      if (currentTotalBalance > initialBalanceValue) {
        enqueueSnackbar(<d.Snackbar title="Payment successful!" subTitle="Your balance has been updated" iconVariant="success" />, { variant: "success" });

        stopPolling();

        // Track analytics for trial users after stopping polling
        if (initialTrialingRef.current) {
          analyticsService.track("trial_completed", {
            category: "user",
            label: "First payment completed"
          });
        }
      }
    },
    [isPolling, currentBalance, stopPolling, enqueueSnackbar, analyticsService, d]
  );

  useEffect(
    function checkForTrialStatusChange() {
      if (!isPolling || !initialTrialingRef.current) {
        return;
      }

      if (initialTrialingRef.current && !wasTrialing) {
        stopPolling();

        enqueueSnackbar(
          <d.Snackbar title="Welcome to Akash!" subTitle="Your trial has been completed. You now have full access to the platform." iconVariant="success" />,
          { variant: "success", autoHideDuration: 10_000 }
        );
      }
    },
    [isPolling, wasTrialing, stopPolling, enqueueSnackbar, d]
  );

  useEffect(
    function stopPollingOnUnmount() {
      return () => {
        stopPolling();
      };
    },
    [stopPolling]
  );

  const contextValue: PaymentPollingContextType = {
    pollForPayment,
    stopPolling,
    isPolling
  };

  return <PaymentPollingContext.Provider value={contextValue}>{children}</PaymentPollingContext.Provider>;
};

export const usePaymentPolling = (): PaymentPollingContextType => {
  const context = useContext(PaymentPollingContext);
  if (!context) {
    throw new Error("usePaymentPolling must be used within a PaymentPollingProvider");
  }
  return context;
};
