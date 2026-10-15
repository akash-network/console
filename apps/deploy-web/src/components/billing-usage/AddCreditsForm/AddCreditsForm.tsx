"use client";

import type { FormEventHandler } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Label,
  LoadingButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from "@akashnetwork/ui/components";

import type { AddCreditsAmountValue } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import { AddCreditsAmountFields } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentMethodSourceHandle } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { AddCreditsWalletButton, type WalletPaymentSource } from "@src/components/billing-usage/AddCreditsWalletButton/AddCreditsWalletButton";
import { FirstPurchaseBonusAlert } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { ThreeDSecurePopup } from "@src/components/shared/PaymentMethodForm/ThreeDSecurePopup";
import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { usePaymentMethodsQuery, usePaymentMutations, useRefreshPaymentMethods, useSetupIntentMutation } from "@src/queries";
import { handleStripeError } from "@src/utils/stripeErrorHandler";
import { useTopUpAttemptKey } from "./useTopUpAttemptKey/useTopUpAttemptKey";

/** Sentinel Select value for entering a new card instead of charging a saved method. */
const NEW_CARD = "new";

export const DEPENDENCIES = {
  AddCreditsAmountFields,
  AddCreditsNewPaymentMethodFields,
  AddCreditsWalletButton,
  FirstPurchaseBonusAlert,
  ThreeDSecurePopup,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useSetupIntentMutation,
  usePaymentMethodsQuery,
  usePaymentMutations,
  usePaymentPolling,
  useRefreshPaymentMethods,
  useServices,
  useWallet,
  useWalletBalance,
  use3DSecure,
  useUser,
  useTopUpAttemptKey,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  getPaymentMethodDisplay,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  handleStripeError
};

interface AddCreditsFormProps {
  onDone: (amount: number, bonusAmount?: number) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  context?: string;
  dependencies?: typeof DEPENDENCIES;
}

interface PaymentAnalytics {
  amount: number;
  type: string;
  isSavedMethod: boolean;
  context?: string;
}

type ThreeDSecureResult = "succeeded" | "failed";

type PaymentFailureStage = "payment_method_setup" | "charge_declined" | "charge_error" | "three_d_secure" | "confirmation_timeout" | "trial_activation_timeout";

interface PaymentFailureDetails {
  errorCode?: string;
  httpStatus?: number;
}

interface PendingCharge {
  paymentMethodId: string;
  amount: number;
  wasTrialing: boolean;
  status: "pending" | "charging";
  idempotencyKey: string;
  analytics: PaymentAnalytics;
}

/**
 * Orchestrates the Add Credits flow. Saved payment methods are offered when
 * the user has any (default pre-selected), with new-card entry as a fallback
 * or explicit choice. On submit it resolves the payment method (saved id, or
 * the swappable child for a new card) and stores it as a pending charge; a
 * reactive effect fires confirmPayment immediately — the managed wallet may
 * still be provisioning, in which case the server replies with a retriable
 * `wallet_provisioning` 409 that the payment mutation retries with backoff
 * until activation lands. It hands off to the 3D Secure popup when required,
 * then waits for payment polling to confirm settlement before notifying the caller
 * through onDone. A poll that exhausts without confirmation is NOT completion:
 * the charge may still settle, so the form releases its in-flight state
 * without onDone and the attempt stays replayable. A new card is confirmed
 * against its SetupIntent only once: retries after a failed charge reuse the
 * saved payment method instead of re-confirming a consumed intent. Each charge
 * carries a replay-safe idempotency key managed by useTopUpAttemptKey.
 */
export function AddCreditsForm({ onDone, onProcessingChange, context, dependencies: d = DEPENDENCIES }: AddCreditsFormProps) {
  const { data: setupIntent, mutate: createSetupIntent, status: setupIntentStatus, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const { user } = d.useUser();
  const { pollForPayment, isPolling, lastOutcome } = d.usePaymentPolling();
  const { stripe, analyticsService } = d.useServices();
  const { isTrialing, topUpMinAmountUsd } = d.useWallet();
  const { balance } = d.useWalletBalance();
  const refreshPaymentMethods = d.useRefreshPaymentMethods();
  const { data: paymentMethods, isLoading: isLoadingMethods, isError: isMethodsError } = d.usePaymentMethodsQuery();
  const {
    confirmPayment: { mutateAsync: confirmPayment }
  } = d.usePaymentMutations();
  const attempt = d.useTopUpAttemptKey();

  const [amountInput, setAmountInput] = useState<AddCreditsAmountValue>({ predefinedAmount: undefined, customAmount: "" });
  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>(undefined);
  const [charge, setCharge] = useState<PendingCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletMethod, setWalletMethod] = useState<{ paymentMethodId: string; type: string } | null>(null);
  const submittingRef = useRef(false);

  const paymentMethodRef = useRef<PaymentMethodSourceHandle>(null);
  /** Payment method already confirmed against the current SetupIntent; reused on retry because a SetupIntent can only be confirmed once. */
  const confirmedNewCardRef = useRef<{ paymentMethodId: string } | null>(null);
  /** Last payment-method type reported to analytics, so the payment element's frequent change events don't re-fire the same type. */
  const lastPaymentTypeRef = useRef<string | null>(null);
  const wasPollingRef = useRef<boolean>(false);
  /** Analytics of the charge awaiting 3D Secure, read by the 3DS callbacks which fire outside the charge flow. */
  const threeDSecureAnalyticsRef = useRef<PaymentAnalytics | null>(null);

  const amount = useMemo(() => Number(amountInput.predefinedAmount || amountInput.customAmount) || 0, [amountInput.predefinedAmount, amountInput.customAmount]);
  const amountError = amount > 0 && amount < topUpMinAmountUsd ? `Minimum amount is $${topUpMinAmountUsd}` : undefined;
  const isSetupLoading = setupIntentStatus === "pending" || setupIntentStatus === "idle";
  const isNewCard = selectedMethodId === NEW_CARD || (selectedMethodId === undefined && !isLoadingMethods && !paymentMethods?.length);
  const isBusy = isProcessing || isWalletOpen;
  const pendingWallet = user?.id ? attempt.getWalletAttempt({ userId: user.id, amount }) : null;
  const pendingWalletId = pendingWallet?.paymentMethodId;
  const pendingWalletType = pendingWallet?.type;

  useEffect(
    function restorePendingWallet() {
      if (!pendingWalletId || !pendingWalletType) return;
      setWalletMethod({ paymentMethodId: pendingWalletId, type: pendingWalletType });
      setSelectedMethodId(pendingWalletId);
    },
    [pendingWalletId, pendingWalletType]
  );

  useEffect(
    function selectDefaultMethodOnce() {
      if (selectedMethodId !== undefined || isLoadingMethods) return;
      setSelectedMethodId(
        paymentMethods?.find(method => method.type === "link")?.id ??
          paymentMethods?.find(method => method.isDefault)?.id ??
          paymentMethods?.[0]?.id ??
          NEW_CARD
      );
    },
    [selectedMethodId, isLoadingMethods, paymentMethods]
  );

  useEffect(
    function createSetupIntentForNewCard() {
      if (isNewCard && setupIntentStatus === "idle") {
        createSetupIntent();
      }
    },
    [isNewCard, setupIntentStatus, createSetupIntent]
  );

  const trackPaymentFailed = useCallback(
    (analytics: PaymentAnalytics | null, stage: PaymentFailureStage, details?: PaymentFailureDetails) => {
      analyticsService.track("add_credits_payment_failed", { category: "billing", ...analytics, stage, ...details });
    },
    [analyticsService]
  );

  const describeSelectedPayment = (): PaymentAnalytics => {
    if (isNewCard) {
      return { amount, type: lastPaymentTypeRef.current ?? "card", isSavedMethod: false, context };
    }
    const savedMethod = paymentMethods?.find(method => method.id === selectedMethodId);
    const type = walletMethod && walletMethod.paymentMethodId === selectedMethodId ? walletMethod.type : toPaymentMethodType(savedMethod?.type ?? "unknown");
    return { amount, type, isSavedMethod: true, context };
  };

  const purchase = async (wallet?: WalletPaymentSource) => {
    if (!user?.id || amount < topUpMinAmountUsd || isProcessing || submittingRef.current || (wallet && attempt.getWalletAttempt({ userId: user.id, amount }))) {
      return;
    }

    submittingRef.current = true;
    setError(null);
    setErrorAction(null);
    setIsProcessing(true);

    const analytics: PaymentAnalytics = wallet ? { amount, type: wallet.type, isSavedMethod: false, context } : describeSelectedPayment();
    if (wallet) analyticsService.track("add_credits_payment_method_selected", { category: "billing", type: wallet.type });
    analyticsService.track("add_credits_payment_submitted", { category: "billing", ...analytics });

    let paymentMethodId = selectedMethodId;

    try {
      if (wallet || isNewCard) {
        let paymentMethod = wallet ? null : confirmedNewCardRef.current;
        if (!paymentMethod) {
          paymentMethod = (await (wallet ?? paymentMethodRef.current)?.addPaymentMethod()) ?? null;
          if (paymentMethod && !wallet) confirmedNewCardRef.current = paymentMethod;
        }
        if (!paymentMethod) {
          trackPaymentFailed(analytics, "payment_method_setup");
          setIsProcessing(false);
          return;
        }
        paymentMethodId = paymentMethod.paymentMethodId;
        if (wallet) {
          setWalletMethod({ ...paymentMethod, type: wallet.type });
          setSelectedMethodId(paymentMethodId);
        }
      }
    } catch {
      trackPaymentFailed(analytics, "payment_method_setup");
      setError("Couldn't prepare your payment. Please check your connection and try again.");
      setIsProcessing(false);
      return;
    } finally {
      submittingRef.current = false;
    }

    if (!paymentMethodId) {
      setIsProcessing(false);
      return;
    }

    setCharge({
      paymentMethodId,
      amount,
      wasTrialing: isTrialing,
      status: "pending",
      idempotencyKey: attempt.resolve({
        userId: user.id,
        amount,
        paymentMethodId,
        walletType: wallet?.type ?? (walletMethod?.paymentMethodId === paymentMethodId ? walletMethod.type : undefined)
      }),
      analytics
    });
  };

  const submit: FormEventHandler<HTMLFormElement> = async e => {
    e.preventDefault();
    if (!isWalletOpen) await purchase();
  };

  /** An exhausted poll leaves the charge outcome unknown: it may still settle, so the attempt key and confirmed card survive for a replay-safe retry while the in-flight form state is released. */
  const releaseChargeKeepingAttempt = useCallback(() => {
    setCharge(null);
    setIsProcessing(false);
    setError("Your payment is still processing. There is no need to pay again. Your balance will update once it completes.");
  }, []);

  const finalizeFailure = useCallback(
    (message: string, userAction?: string | null) => {
      setCharge(null);
      setIsProcessing(false);
      setError(message);
      setErrorAction(userAction ?? null);

      if (confirmedNewCardRef.current) {
        // confirmSetup already saved the card even though the charge failed; surface it in the saved-methods list.
        refreshPaymentMethods();
      }
    },
    [refreshPaymentMethods]
  );

  const trackThreeDSecureCompleted = (result: ThreeDSecureResult) => {
    analyticsService.track("add_credits_3ds_completed", { category: "billing", ...threeDSecureAnalyticsRef.current, result });
  };

  const threeDSecure = d.use3DSecure({
    onSuccess: function onThreeDSecureSuccess() {
      trackThreeDSecureCompleted("succeeded");
      pollForPayment();
    },
    onError: function onThreeDSecureError(message) {
      trackThreeDSecureCompleted("failed");
      trackPaymentFailed(threeDSecureAnalyticsRef.current, "three_d_secure");
      finalizeFailure(message);
    },
    showSuccessMessage: false,
    showErrorMessage: false
  });

  /** A replayed attempt the webhook already credited settles polling against the pre-charge baseline: the balance rose before polling started, so the default start-of-poll snapshot would never register an increase and the flow would time out. */
  const pollForAlreadyCreditedPayment = useCallback(
    (chargedAmount: number) => {
      pollForPayment({ initialBalance: balance ? balance.totalUsd - chargedAmount : null });
    },
    [pollForPayment, balance]
  );

  const performCharge = useCallback(
    async function performCharge(pending: PendingCharge) {
      if (!user?.id) return;

      try {
        const chargeResult = await confirmPayment({
          userId: user.id,
          paymentMethodId: pending.paymentMethodId,
          amount: pending.amount,
          idempotencyKey: pending.idempotencyKey
        });

        if (chargeResult.requiresAction && chargeResult.clientSecret && chargeResult.paymentIntentId) {
          threeDSecureAnalyticsRef.current = pending.analytics;
          analyticsService.track("add_credits_3ds_required", { category: "billing", ...pending.analytics });
          threeDSecure.start3DSecure({
            clientSecret: chargeResult.clientSecret,
            paymentIntentId: chargeResult.paymentIntentId,
            paymentMethodId: pending.paymentMethodId
          });
          return;
        }

        if (chargeResult.success) {
          if (chargeResult.transactionStatus === "succeeded") {
            pollForAlreadyCreditedPayment(pending.amount);
          } else {
            pollForPayment();
          }
          return;
        }

        trackPaymentFailed(pending.analytics, "charge_declined");
        finalizeFailure("Payment failed. Please try again.");
      } catch (err) {
        attempt.clearIfConcluded(err);
        trackPaymentFailed(pending.analytics, "charge_error", toPaymentFailureDetails(err));

        const stripeError = d.handleStripeError(err);
        finalizeFailure(stripeError.message, stripeError.userAction);
      }
    },
    [user?.id, confirmPayment, threeDSecure, pollForPayment, pollForAlreadyCreditedPayment, finalizeFailure, trackPaymentFailed, analyticsService, attempt, d]
  );

  useEffect(
    function chargePendingTopUp() {
      if (!charge || charge.status !== "pending" || charge.amount < topUpMinAmountUsd) return;

      setCharge({ ...charge, status: "charging" });
      void performCharge(charge);
    },
    [charge, topUpMinAmountUsd, performCharge]
  );

  useEffect(
    function completeWhenPollingSettles() {
      const wasPolling = wasPollingRef.current;
      wasPollingRef.current = isPolling;

      if (!wasPolling || isPolling || !charge) return;

      if (lastOutcome !== "success") {
        trackPaymentFailed(charge.analytics, "confirmation_timeout");
        releaseChargeKeepingAttempt();
        return;
      }

      if (charge.wasTrialing && isTrialing) {
        trackPaymentFailed(charge.analytics, "trial_activation_timeout");
        finalizeFailure("Payment did not complete in time. Please try again.");
        return;
      }

      confirmedNewCardRef.current = null;
      attempt.clear();
      setCharge(null);
      analyticsService.track("add_credits_purchased", { category: "billing", ...charge.analytics });

      const { amount } = charge;
      void (async function completeWithGrantedBonus() {
        // Polling settles only after the webhook topped up the wallet, so the granted
        // first-purchase bonus is already recorded on the latest transaction.
        let bonusAmount = 0;
        try {
          const { transactions } = await stripe.getCustomerTransactions({ limit: 1 });
          const latest = transactions[0];
          if (latest?.status === "succeeded" && latest.amount === Math.round(amount * 100)) {
            bonusAmount = (latest.bonusAmount ?? 0) / 100;
          }
        } catch {
          // Bonus display is best-effort; completion must proceed without it.
        }
        onDone(amount, bonusAmount);
        setIsProcessing(false);
      })();
    },
    [isPolling, lastOutcome, isTrialing, charge, releaseChargeKeepingAttempt, finalizeFailure, trackPaymentFailed, attempt, onDone, stripe, analyticsService]
  );

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isBusy);
    },
    [isBusy, onProcessingChange]
  );

  const changeSelectedMethod = useCallback(
    (methodId: string) => {
      if (methodId === NEW_CARD) {
        lastPaymentTypeRef.current = null;
        if (confirmedNewCardRef.current) {
          confirmedNewCardRef.current = null;
          resetSetupIntent();
        }
      }
      setSelectedMethodId(methodId);
      const method = methodId === NEW_CARD ? undefined : paymentMethods?.find(candidate => candidate.id === methodId);
      if (method) {
        analyticsService.track("add_credits_payment_method_selected", { category: "billing", type: toPaymentMethodType(method.type) });
      }
    },
    [resetSetupIntent, paymentMethods, analyticsService]
  );

  const trackAmountSelected = useCallback(
    (amount: number, isCustom: boolean) => {
      if (amount > 0) {
        analyticsService.track("add_credits_amount_selected", { category: "billing", amount, isCustom });
      }
    },
    [analyticsService]
  );

  const trackPaymentTypeSelected = useCallback(
    (type: string) => {
      const normalizedType = toPaymentMethodType(type);
      if (lastPaymentTypeRef.current === normalizedType) {
        return;
      }
      lastPaymentTypeRef.current = normalizedType;
      analyticsService.track("add_credits_payment_method_selected", { category: "billing", type: normalizedType });
    },
    [analyticsService]
  );

  return (
    <>
      <d.FirstPurchaseBonusAlert amount={amount} />

      <form className="space-y-6" onSubmit={submit}>
        <fieldset disabled={isBusy} className="space-y-6">
          <d.AddCreditsAmountFields
            value={amountInput}
            onChange={setAmountInput}
            minAmount={topUpMinAmountUsd}
            error={amountError}
            onAmountCommit={trackAmountSelected}
          />

          <d.AddCreditsWalletButton
            amount={amount}
            disabled={isBusy || amount < topUpMinAmountUsd || isLoadingMethods || !!pendingWallet}
            onSubmit={purchase}
            onOpenChange={setIsWalletOpen}
          />

          {pendingWallet && !isBusy && (
            <p className="text-sm text-muted-foreground">
              Your wallet payment is awaiting confirmation. Retry the saved wallet below to check it without starting another charge.
            </p>
          )}

          {isMethodsError && (
            <Alert variant="destructive">
              <AlertDescription>We couldn&apos;t load your saved payment methods. You can still pay with a new card.</AlertDescription>
            </Alert>
          )}

          {isLoadingMethods ? (
            <d.Skeleton className="h-10 w-full" />
          ) : (
            (!!paymentMethods?.length || !!walletMethod) && (
              <div className="space-y-2">
                <d.Label htmlFor="add-credits-payment-method">Payment method</d.Label>
                <d.Select value={selectedMethodId ?? ""} onValueChange={changeSelectedMethod} disabled={isBusy}>
                  <d.SelectTrigger id="add-credits-payment-method">
                    <d.SelectValue placeholder="Select a payment method" />
                  </d.SelectTrigger>
                  <d.SelectContent>
                    {paymentMethods?.map(method => (
                      <d.SelectItem key={method.id} value={method.id}>
                        {d.getPaymentMethodDisplay(method).label}
                      </d.SelectItem>
                    ))}
                    {walletMethod && !paymentMethods?.some(method => method.id === walletMethod.paymentMethodId) && (
                      <d.SelectItem value={walletMethod.paymentMethodId}>
                        {walletMethod.type === "apple_pay" ? "Apple Pay" : walletMethod.type === "google_pay" ? "Google Pay" : "Wallet"}
                      </d.SelectItem>
                    )}
                    <d.SelectItem value={NEW_CARD}>Add new payment method</d.SelectItem>
                  </d.SelectContent>
                </d.Select>
              </div>
            )
          )}

          {isNewCard && setupIntentStatus === "error" && (
            <Alert variant="destructive">
              <AlertDescription>We couldn&apos;t load the payment form. Please try again.</AlertDescription>
              <Button type="button" variant="outline" onClick={() => createSetupIntent()} className="mt-2">
                Retry
              </Button>
            </Alert>
          )}

          {isNewCard && (
            <d.AddCreditsNewPaymentMethodFields
              ref={paymentMethodRef}
              clientSecret={setupIntent?.clientSecret}
              isLoading={isSetupLoading}
              disabled={isBusy || !!confirmedNewCardRef.current}
              onPaymentTypeChange={trackPaymentTypeSelected}
            />
          )}

          {isNewCard && confirmedNewCardRef.current && !isBusy && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your payment method is saved for this purchase. You can retry with it or use a different payment method.
              </p>
              <Button type="button" variant="outline" onClick={() => changeSelectedMethod(NEW_CARD)}>
                Use a different payment method
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="block font-medium">{error}</span>
                {errorAction && <span className="mt-1 block text-sm">{errorAction}</span>}
              </AlertDescription>
            </Alert>
          )}

          <LoadingButton
            type="submit"
            className="w-full"
            loading={isProcessing}
            disabled={isBusy || amount < topUpMinAmountUsd || isLoadingMethods || (isNewCard && (isSetupLoading || setupIntentStatus === "error"))}
          >
            Purchase Credits
          </LoadingButton>
        </fieldset>
      </form>

      {threeDSecure.threeDSData?.clientSecret && (
        <d.ThreeDSecurePopup
          isOpen={threeDSecure.isOpen}
          onSuccess={threeDSecure.handle3DSSuccess}
          onError={threeDSecure.handle3DSError}
          clientSecret={threeDSecure.threeDSData.clientSecret}
          paymentIntentId={threeDSecure.threeDSData.paymentIntentId}
          paymentMethodId={threeDSecure.threeDSData.paymentMethodId}
          title="Payment Authentication"
          description="Your bank requires additional verification for this payment."
          successMessage="Payment authenticated successfully!"
          errorMessage="Please try again or use a different payment method."
        />
      )}
    </>
  );
}

function toPaymentFailureDetails(error: unknown): PaymentFailureDetails {
  const { response } = (error ?? {}) as { response?: { status?: number; data?: { code?: string } } };
  return { errorCode: response?.data?.code, httpStatus: response?.status };
}

/** Maps a Stripe payment-method type (`card`, `us_bank_account`, …) to the coarse label reported to analytics. */
function toPaymentMethodType(rawType: string): string {
  if (rawType === "card") return "card";
  if (rawType.includes("bank")) return "bank";
  return rawType;
}
