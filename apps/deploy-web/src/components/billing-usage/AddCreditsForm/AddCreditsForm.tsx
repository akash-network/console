"use client";

import type { FormEventHandler } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Label,
  LoadingButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";

import type { AddCreditsAmountValue } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import { AddCreditsAmountFields } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentMethodSourceHandle } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { FirstPurchaseBonusAlert } from "@src/components/billing-usage/FirstPurchaseBonusAlert/FirstPurchaseBonusAlert";
import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { ThreeDSecurePopup } from "@src/components/shared/PaymentMethodForm/ThreeDSecurePopup";
import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { QueryKeys, usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
import { handleStripeError } from "@src/utils/stripeErrorHandler";

/** Sentinel Select value for entering a new card instead of charging a saved method. */
const NEW_CARD = "new";

export const DEPENDENCIES = {
  AddCreditsAmountFields,
  AddCreditsNewPaymentMethodFields,
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
  useQueryClient,
  useServices,
  useWallet,
  useWalletBalance,
  use3DSecure,
  useUser,
  getPaymentMethodDisplay,
  handleStripeError
};

interface AddCreditsFormProps {
  onDone: (amount: number, organization?: string, bonusAmount?: number) => void;
  isWalletReady?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  dependencies?: typeof DEPENDENCIES;
}

interface PendingCharge {
  paymentMethodId: string;
  organization?: string;
  amount: number;
  wasTrialing: boolean;
  status: "pending" | "charging";
  idempotencyKey: string;
}

interface StoredAttempt {
  key: string;
  amountCents: number;
  paymentMethodId: string;
  userId: string;
  createdAt: number;
}

/** Attempt keys persist per tab so closing and reopening the errored sheet (which unmounts the form) retries the same attempt instead of minting a fresh charge. */
const ATTEMPT_STORAGE_KEY = "add-credits-attempt";

/** A stored attempt older than this is treated as a new purchase, not a retry. It matches Stripe's 24h replay window: expiring sooner would mint a fresh key (and possibly a duplicate charge) while the original attempt could still settle. */
const ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** sessionStorage access throws in some privacy modes; attempt-key persistence is best-effort and must never break the purchase flow. */
function safeSessionStorage<T>(operation: () => T): T | undefined {
  try {
    return operation();
  } catch {
    return undefined;
  }
}

function readStoredAttemptKey(input: { userId: string; amountCents: number; paymentMethodId: string }): string | null {
  const raw = safeSessionStorage(() => window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY));
  if (!raw) return null;

  const stored = safeSessionStorage(() => JSON.parse(raw) as StoredAttempt);
  if (!stored) return null;

  const isCurrentAttempt =
    stored.userId === input.userId &&
    stored.amountCents === input.amountCents &&
    stored.paymentMethodId === input.paymentMethodId &&
    Date.now() - stored.createdAt < ATTEMPT_MAX_AGE_MS;

  return isCurrentAttempt ? stored.key : null;
}

function writeStoredAttempt(attempt: StoredAttempt): void {
  safeSessionStorage(() => window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt)));
}

function clearStoredAttempt(): void {
  safeSessionStorage(() => window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY));
}

/** Two responses prove the attempt is dead: a 402 (the bank definitively declined, and Stripe replays that decline for the key's lifetime) and a 409 idempotency_key_mismatch (the key is permanently bound to different parameters). Retrying either with the same key could never succeed. Every other failure (timeout, 4xx/5xx, no response) leaves the outcome unknown and the key must survive. */
function isAttemptConcluded(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("response" in error)) return false;

  const response = (error as { response?: { status?: number; data?: { code?: string } } }).response;

  return response?.status === 402 || (response?.status === 409 && response.data?.code === "idempotency_key_mismatch");
}

/**
 * Orchestrates the Add Credits flow: collecting a payment method is always
 * allowed, but the charge waits until the managed wallet is ready. Saved
 * payment methods are offered when the user has any (default pre-selected),
 * with new-card entry as a fallback or explicit choice. On submit it resolves
 * the payment method (saved id, or the swappable child for a new card) and
 * stores it as a pending charge; a reactive effect fires confirmPayment once
 * the wallet is ready, hands off to the 3D Secure popup when required, then
 * waits for payment polling to confirm settlement before notifying the caller
 * through onDone. A poll that exhausts without confirmation is NOT completion:
 * the charge may still settle, so the form releases its in-flight state
 * without onDone and the attempt stays replayable. A new card is confirmed
 * against its SetupIntent only once: retries after a failed charge reuse the
 * saved payment method instead of re-confirming a consumed intent. Every
 * attempt carries an idempotency key that survives unknown-outcome failures
 * (and remounts, via sessionStorage) and rotates only when the attempt
 * concludes (polling confirmed settlement, a definitive 402 decline, or a 409
 * key mismatch) or its params change, so a retried slow charge replays the
 * original attempt instead of charging again.
 */
export function AddCreditsForm({ onDone, isWalletReady = true, onProcessingChange, dependencies: d = DEPENDENCIES }: AddCreditsFormProps) {
  const { data: setupIntent, mutate: createSetupIntent, status: setupIntentStatus, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const { user } = d.useUser();
  const { pollForPayment, isPolling, lastOutcome } = d.usePaymentPolling();
  const { stripe, analyticsService } = d.useServices();
  const { isTrialing, topUpMinAmountUsd } = d.useWallet();
  const { balance } = d.useWalletBalance();
  const queryClient = d.useQueryClient();
  const { data: paymentMethods, isLoading: isLoadingMethods, isError: isMethodsError } = d.usePaymentMethodsQuery();
  const {
    confirmPayment: { mutateAsync: confirmPayment }
  } = d.usePaymentMutations();

  const [amountInput, setAmountInput] = useState<AddCreditsAmountValue>({ predefinedAmount: undefined, customAmount: "" });
  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>(undefined);
  const [charge, setCharge] = useState<PendingCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentMethodRef = useRef<PaymentMethodSourceHandle>(null);
  /** Payment method already confirmed against the current SetupIntent; reused on retry because a SetupIntent can only be confirmed once. */
  const confirmedNewCardRef = useRef<{ paymentMethodId: string; organization?: string } | null>(null);
  /** Attempt key outlives PendingCharge: finalizeFailure clears the charge while the key must survive unknown-outcome failures, so a retry replays the same attempt instead of charging again. */
  const attemptRef = useRef<{ key: string; amount: number; paymentMethodId: string } | null>(null);
  const wasPollingRef = useRef<boolean>(false);
  /** Last payment-method type reported to analytics, so the payment element's frequent change events don't re-fire the same type. */
  const lastPaymentTypeRef = useRef<string | null>(null);

  const amount = useMemo(() => Number(amountInput.predefinedAmount || amountInput.customAmount) || 0, [amountInput.predefinedAmount, amountInput.customAmount]);
  const amountError = amount > 0 && amount < topUpMinAmountUsd ? `Minimum amount is $${topUpMinAmountUsd}` : undefined;
  const isSetupLoading = setupIntentStatus === "pending" || setupIntentStatus === "idle";
  const isNewCard = selectedMethodId === NEW_CARD || (!isLoadingMethods && !paymentMethods?.length);

  useEffect(
    function selectDefaultMethodOnce() {
      if (selectedMethodId !== undefined || isLoadingMethods || !paymentMethods?.length) return;
      setSelectedMethodId(paymentMethods.find(method => method.isDefault)?.id ?? paymentMethods[0].id);
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

  const submit: FormEventHandler<HTMLFormElement> = async e => {
    e.preventDefault();

    if (!user?.id || amount < topUpMinAmountUsd) {
      return;
    }

    setError(null);
    setErrorAction(null);
    setIsProcessing(true);

    let paymentMethodId = selectedMethodId;
    let organization: string | undefined;

    if (isNewCard) {
      let paymentMethod = confirmedNewCardRef.current;
      if (!paymentMethod) {
        paymentMethod = (await paymentMethodRef.current?.addPaymentMethod()) ?? null;
        if (!paymentMethod) {
          setIsProcessing(false);
          return;
        }
        confirmedNewCardRef.current = paymentMethod;
      }
      paymentMethodId = paymentMethod.paymentMethodId;
      organization = paymentMethod.organization;
    }

    if (!paymentMethodId) {
      setIsProcessing(false);
      return;
    }

    setCharge({
      paymentMethodId,
      organization,
      amount,
      wasTrialing: isTrialing,
      status: "pending",
      idempotencyKey: resolveAttemptKey(paymentMethodId, user.id)
    });
  };

  /**
   * Reuses the in-memory key while the purchase params are unchanged (a retry of the same attempt),
   * rehydrates a matching persisted key after a remount, and only otherwise mints a fresh one.
   */
  function resolveAttemptKey(paymentMethodId: string, userId: string): string {
    const amountCents = Math.round(amount * 100);
    const current = attemptRef.current;

    if (current && current.amount === amount && current.paymentMethodId === paymentMethodId) {
      return current.key;
    }

    const rehydratedKey = readStoredAttemptKey({ userId, amountCents, paymentMethodId });

    if (rehydratedKey) {
      attemptRef.current = { key: rehydratedKey, amount, paymentMethodId };
      return rehydratedKey;
    }

    const key = crypto.randomUUID();
    attemptRef.current = { key, amount, paymentMethodId };
    writeStoredAttempt({ key, amountCents, paymentMethodId, userId, createdAt: Date.now() });

    return key;
  }

  const clearAttempt = useCallback(() => {
    attemptRef.current = null;
    clearStoredAttempt();
  }, []);

  /** An exhausted poll leaves the charge outcome unknown: it may still settle, so the attempt key and confirmed card survive for a replay-safe retry while the in-flight form state is released. */
  const releaseChargeKeepingAttempt = useCallback(() => {
    setCharge(null);
    setIsProcessing(false);
  }, []);

  const finalizeFailure = useCallback(
    (message: string, userAction?: string | null) => {
      setCharge(null);
      setIsProcessing(false);
      setError(message);
      setErrorAction(userAction ?? null);

      if (confirmedNewCardRef.current) {
        // confirmSetup already saved the card even though the charge failed; surface it in the saved-methods list.
        queryClient.invalidateQueries({ queryKey: QueryKeys.getPaymentMethodsKey() });
      }
    },
    [queryClient]
  );

  const threeDSecure = d.use3DSecure({
    onSuccess: function onThreeDSecureSuccess() {
      pollForPayment();
    },
    onError: function onThreeDSecureError(message) {
      finalizeFailure(message);
    },
    showSuccessMessage: false
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

        finalizeFailure("Payment failed. Please try again.");
      } catch (err) {
        if (isAttemptConcluded(err)) {
          clearAttempt();
        }

        const stripeError = d.handleStripeError(err);
        finalizeFailure(stripeError.message, stripeError.userAction);
      }
    },
    [user?.id, confirmPayment, threeDSecure, pollForPayment, pollForAlreadyCreditedPayment, finalizeFailure, clearAttempt, d]
  );

  useEffect(
    function chargeWhenWalletReady() {
      if (!charge || charge.status !== "pending" || charge.amount < topUpMinAmountUsd || !isWalletReady) return;

      setCharge({ ...charge, status: "charging" });
      void performCharge(charge);
    },
    [charge, isWalletReady, topUpMinAmountUsd, performCharge]
  );

  useEffect(
    function completeWhenPollingSettles() {
      const wasPolling = wasPollingRef.current;
      wasPollingRef.current = isPolling;

      if (!wasPolling || isPolling || !charge) return;

      if (lastOutcome !== "success") {
        releaseChargeKeepingAttempt();
        return;
      }

      if (charge.wasTrialing && isTrialing) {
        finalizeFailure("Payment did not complete in time. Please try again.");
        return;
      }

      confirmedNewCardRef.current = null;
      clearAttempt();
      setCharge(null);
      setIsProcessing(false);

      const { amount, organization } = charge;
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
        onDone(amount, organization, bonusAmount);
      })();
    },
    [isPolling, lastOutcome, isTrialing, charge, releaseChargeKeepingAttempt, finalizeFailure, clearAttempt, onDone, stripe]
  );

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isProcessing);
    },
    [isProcessing, onProcessingChange]
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
        <d.AddCreditsAmountFields
          value={amountInput}
          onChange={setAmountInput}
          minAmount={topUpMinAmountUsd}
          error={amountError}
          onAmountCommit={trackAmountSelected}
        />

        {isMethodsError && (
          <Alert variant="destructive">
            <AlertDescription>We couldn&apos;t load your saved payment methods. You can still pay with a new card.</AlertDescription>
          </Alert>
        )}

        {isLoadingMethods ? (
          <d.Skeleton className="h-10 w-full" />
        ) : (
          !!paymentMethods?.length && (
            <div className="space-y-2">
              <d.Label htmlFor="add-credits-payment-method">Payment method</d.Label>
              <d.Select value={selectedMethodId ?? ""} onValueChange={changeSelectedMethod}>
                <d.SelectTrigger id="add-credits-payment-method">
                  <d.SelectValue placeholder="Select a payment method" />
                </d.SelectTrigger>
                <d.SelectContent>
                  {paymentMethods.map(method => (
                    <d.SelectItem key={method.id} value={method.id}>
                      {d.getPaymentMethodDisplay(method).label}
                    </d.SelectItem>
                  ))}
                  <d.SelectItem value={NEW_CARD}>Add new payment method</d.SelectItem>
                </d.SelectContent>
              </d.Select>
            </div>
          )
        )}

        {isNewCard && (
          <d.AddCreditsNewPaymentMethodFields
            ref={paymentMethodRef}
            clientSecret={setupIntent?.clientSecret}
            isLoading={isSetupLoading}
            onPaymentTypeChange={trackPaymentTypeSelected}
          />
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
          disabled={amount < topUpMinAmountUsd || isLoadingMethods || (isNewCard && isSetupLoading)}
        >
          Purchase Credits
        </LoadingButton>
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

/** Maps a Stripe payment-method type (`card`, `us_bank_account`, …) to the coarse label reported to analytics. */
function toPaymentMethodType(rawType: string): string {
  if (rawType === "card") return "card";
  if (rawType.includes("bank")) return "bank";
  return rawType;
}
