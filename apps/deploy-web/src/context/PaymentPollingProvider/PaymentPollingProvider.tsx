"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { useWalletBalance } from "@src/hooks/useWalletBalance";

const POLLING_INTERVAL_MS = 1000;
const MAX_POLLING_DURATION_MS = 30000;

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
  const { balance: currentBalance, refetch: refetchBalance } = d.useWalletBalance();
  const { refetch: refetchManagedWallet } = d.useManagedWallet();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();

  const [isPolling, setIsPolling] = React.useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const initialBalanceRef = useRef<number | null>(null);
  const wasTrialingRef = useRef<boolean>(wasTrialing);
  const initialTrialingRef = useRef<boolean>(wasTrialing);
  const loadingSnackbarKeyRef = useRef<string | number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    startTimeRef.current = null;
    initialBalanceRef.current = null;
    initialTrialingRef.current = wasTrialing;

    if (loadingSnackbarKeyRef.current) {
      closeSnackbar(loadingSnackbarKeyRef.current);
      loadingSnackbarKeyRef.current = null;
    }
  }, [closeSnackbar, wasTrialing]);

  const pollForPayment = useCallback(
    (initialBalance?: number | null) => {
      if (isPolling) {
        return;
      }

      const balanceToUse = initialBalance ?? currentBalance?.totalUsd ?? null;
      initialBalanceRef.current = balanceToUse;
      initialTrialingRef.current = wasTrialing;
      setIsPolling(true);
      startTimeRef.current = Date.now();

      const loadingSnackbarKey = enqueueSnackbar(<d.Snackbar title="Processing payment..." subTitle="Please wait while we update your balance" showLoading />, {
        variant: "info",
        autoHideDuration: null,
        persist: true
      });
      loadingSnackbarKeyRef.current = loadingSnackbarKey;

      pollingRef.current = setInterval(async () => {
        const elapsed = Date.now() - (startTimeRef.current || 0);

        if (elapsed >= MAX_POLLING_DURATION_MS) {
          stopPolling();
          enqueueSnackbar(<d.Snackbar title="Payment processing timeout" subTitle="Please refresh the page to check your balance" iconVariant="warning" />, {
            variant: "warning"
          });
          return;
        }

        refetchBalance();
        refetchManagedWallet();
      }, POLLING_INTERVAL_MS);
    },
    [isPolling, currentBalance, refetchBalance, refetchManagedWallet, stopPolling, enqueueSnackbar, wasTrialing]
  );

  useEffect(
    function updateWasTrialingRef() {
      wasTrialingRef.current = wasTrialing;
    },
    [wasTrialing]
  );

  useEffect(
    function checkForPaymentCompletion() {
      if (!isPolling || !currentBalance || !initialBalanceRef.current) {
        return;
      }

      const currentTotalBalance = currentBalance.totalUsd;
      const initialBalanceValue = initialBalanceRef.current;

      if (currentTotalBalance > initialBalanceValue) {
        enqueueSnackbar(<d.Snackbar title="Payment successful!" subTitle="Your balance has been updated" iconVariant="success" />, { variant: "success" });

        // If user was not trialing, we can stop polling immediately
        if (!initialTrialingRef.current) {
          stopPolling();
          return;
        }

        analyticsService.track("trial_completed", {
          category: "user",
          label: "First payment completed"
        });
      }
    },
    [isPolling, currentBalance, stopPolling, enqueueSnackbar, analyticsService]
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
    [isPolling, wasTrialing, stopPolling, enqueueSnackbar]
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
