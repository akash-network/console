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
}

/**
 * Orchestrates the Add Credits flow: collecting a payment method is always
 * allowed, but the charge waits until the managed wallet is ready. Saved
 * payment methods are offered when the user has any (default pre-selected),
 * with new-card entry as a fallback or explicit choice. On submit it resolves
 * the payment method (saved id, or the swappable child for a new card) and
 * stores it as a pending charge; a reactive effect fires confirmPayment once
 * the wallet is ready, hands off to the 3D Secure popup when required, then
 * waits for payment polling to settle before notifying the caller through
 * onDone. A new card is confirmed against its SetupIntent only once: retries
 * after a failed charge reuse the saved payment method instead of
 * re-confirming a consumed intent.
 */
export function AddCreditsForm({ onDone, isWalletReady = true, onProcessingChange, dependencies: d = DEPENDENCIES }: AddCreditsFormProps) {
  const { data: setupIntent, mutate: createSetupIntent, status: setupIntentStatus, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const { user } = d.useUser();
  const { pollForPayment, isPolling } = d.usePaymentPolling();
  const { stripe } = d.useServices();
  const { isTrialing, topUpMinAmountUsd } = d.useWallet();
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
  const wasPollingRef = useRef<boolean>(false);

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
      status: "pending"
    });
  };

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

  const performCharge = useCallback(
    async function performCharge(pending: PendingCharge) {
      if (!user?.id) return;

      try {
        const chargeResult = await confirmPayment({
          userId: user.id,
          paymentMethodId: pending.paymentMethodId,
          amount: pending.amount
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
          pollForPayment();
          return;
        }

        finalizeFailure("Payment failed. Please try again.");
      } catch (err) {
        const stripeError = d.handleStripeError(err);
        finalizeFailure(stripeError.message, stripeError.userAction);
      }
    },
    [user?.id, confirmPayment, threeDSecure, pollForPayment, finalizeFailure, d]
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

      if (charge.wasTrialing && isTrialing) {
        finalizeFailure("Payment did not complete in time. Please try again.");
        return;
      }

      confirmedNewCardRef.current = null;
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
    [isPolling, isTrialing, charge, finalizeFailure, onDone, stripe]
  );

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isProcessing);
    },
    [isProcessing, onProcessingChange]
  );

  const changeSelectedMethod = useCallback(
    (methodId: string) => {
      if (methodId === NEW_CARD && confirmedNewCardRef.current) {
        // The previous SetupIntent was consumed by confirmSetup; a fresh one is required to collect a different card.
        confirmedNewCardRef.current = null;
        resetSetupIntent();
      }
      setSelectedMethodId(methodId);
    },
    [resetSetupIntent]
  );

  return (
    <>
      <d.FirstPurchaseBonusAlert amount={amount} />

      <form className="space-y-6" onSubmit={submit}>
        <d.AddCreditsAmountFields value={amountInput} onChange={setAmountInput} minAmount={topUpMinAmountUsd} error={amountError} />

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

        {isNewCard && <d.AddCreditsNewPaymentMethodFields ref={paymentMethodRef} clientSecret={setupIntent?.clientSecret} isLoading={isSetupLoading} />}

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
