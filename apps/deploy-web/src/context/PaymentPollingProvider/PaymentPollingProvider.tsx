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

export type PaymentPollingVariant = "payment" | "coupon";

export type PaymentPollingOutcome = "success" | "timeout";

/**
 * Snackbar copy per flow. The coupon flow avoids "payment" wording since redeeming a coupon is not a charge.
 * The `timeout` copy deliberately frames an exhausted poll as still-pending, not failed: the charge usually
 * succeeded and is just settling slower than the poll window, so the message reassures instead of nudging a
 * retry (a retried slow-but-successful charge is what produced the duplicate top-ups in CON-684).
 */
const POLLING_COPY: Record<
  PaymentPollingVariant,
  { loading: { title: string; subTitle: string }; success: { title: string; subTitle: string }; timeout: { title: string; subTitle: string } }
> = {
  payment: {
    loading: { title: "Processing payment...", subTitle: "Please wait while we update your balance" },
    success: { title: "Payment successful!", subTitle: "Your balance has been updated" },
    timeout: {
      title: "Your payment is still processing",
      subTitle: "This is taking longer than usual — no need to pay again. Your balance will update shortly once it completes."
    }
  },
  coupon: {
    loading: { title: "Applying coupon...", subTitle: "Please wait while we add your credits" },
    success: { title: "Coupon applied!", subTitle: "Your balance has been updated" },
    timeout: {
      title: "Your coupon is still processing",
      subTitle: "This is taking longer than usual. Your balance will update shortly once it completes."
    }
  }
};

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
   * Start polling for balance updates after a payment or coupon redemption.
   * `variant` selects the snackbar copy (defaults to "payment").
   */
  pollForPayment: (options?: { initialBalance?: number | null; variant?: PaymentPollingVariant }) => void;
  /**
   * Stop polling (optional - usually not needed)
   */
  stopPolling: () => void;
  /**
   * Whether currently polling
   */
  isPolling: boolean;
  /**
   * Terminal outcome of the most recent poll: "success" once settlement was
   * confirmed (balance rose or the trial flipped), "timeout" when polling
   * exhausted without confirmation — the payment may still settle later, so
   * exhaustion must not be treated as completion. Null while polling or
   * before the first poll.
   */
  lastOutcome: PaymentPollingOutcome | null;
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
  const [lastOutcome, setLastOutcome] = React.useState<PaymentPollingOutcome | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const attemptCountRef = useRef<number>(0);
  const initialBalanceRef = useRef<number | null>(null);
  const wasTrialingRef = useRef<boolean>(wasTrialing);
  const initialTrialingRef = useRef<boolean>(wasTrialing);
  const loadingSnackbarKeyRef = useRef<string | number | null>(null);
  const hasSignaledSuccessRef = useRef<boolean>(false);
  const variantRef = useRef<PaymentPollingVariant>("payment");

  const closeLoadingSnackbar = useCallback(() => {
    if (loadingSnackbarKeyRef.current) {
      closeSnackbar(loadingSnackbarKeyRef.current);
      loadingSnackbarKeyRef.current = null;
    }
  }, [closeSnackbar, loadingSnackbarKeyRef]);

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

    closeLoadingSnackbar();
  }, [closeLoadingSnackbar, wasTrialing]);

  const executePoll = useCallback(() => {
    attemptCountRef.current++;

    if (attemptCountRef.current > MAX_ATTEMPTS) {
      stopPolling();
      setLastOutcome(hasSignaledSuccessRef.current ? "success" : "timeout");
      if (!hasSignaledSuccessRef.current) {
        const { title, subTitle } = POLLING_COPY[variantRef.current].timeout;
        enqueueSnackbar(<d.Snackbar title={title} subTitle={subTitle} iconVariant="info" />, {
          variant: "info"
        });
      }
      return;
    }

    refetchBalance();
    refetchManagedWallet();
  }, [stopPolling, enqueueSnackbar, refetchBalance, refetchManagedWallet, d]);

  const pollForPayment = useCallback(
    (options?: { initialBalance?: number | null; variant?: PaymentPollingVariant }) => {
      if (isPolling) {
        return;
      }

      variantRef.current = options?.variant ?? "payment";
      const balanceToUse = options?.initialBalance ?? currentBalance?.totalUsd ?? null;
      initialBalanceRef.current = balanceToUse;
      initialTrialingRef.current = wasTrialing;
      hasSignaledSuccessRef.current = false;
      isPollingRef.current = true;
      attemptCountRef.current = 0;
      setLastOutcome(null);
      setIsPolling(true);

      const { title, subTitle } = POLLING_COPY[variantRef.current].loading;
      const loadingSnackbarKey = enqueueSnackbar(<d.Snackbar title={title} subTitle={subTitle} showLoading />, {
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
      if (!isPolling || hasSignaledSuccessRef.current) {
        return;
      }

      const balanceIncreased = currentBalance != null && initialBalanceRef.current != null && currentBalance.totalUsd > initialBalanceRef.current;
      const trialFlipped = initialTrialingRef.current && !wasTrialing;

      if (!balanceIncreased && !trialFlipped) {
        return;
      }

      hasSignaledSuccessRef.current = true;
      closeLoadingSnackbar();
      const { title, subTitle } = POLLING_COPY[variantRef.current].success;
      enqueueSnackbar(<d.Snackbar title={title} subTitle={subTitle} iconVariant="success" />, { variant: "success" });

      if (initialTrialingRef.current) {
        analyticsService.track("trial_completed", {
          category: "user",
          label: "First payment completed"
        });
      } else {
        stopPolling();
        setLastOutcome("success");
      }
    },
    [isPolling, currentBalance, wasTrialing, stopPolling, enqueueSnackbar, analyticsService, d, closeLoadingSnackbar]
  );

  useEffect(
    function checkForTrialStatusChange() {
      if (!isPolling || !initialTrialingRef.current) {
        return;
      }

      if (initialTrialingRef.current && !wasTrialing) {
        stopPolling();
        setLastOutcome("success");

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
    isPolling,
    lastOutcome
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
