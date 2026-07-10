"use client";

import type { FormEventHandler } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner
} from "@akashnetwork/ui/components";
import { GiftIcon } from "lucide-react";

import type { AddCreditsAmountValue } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import { AddCreditsAmountFields } from "@src/components/billing-usage/AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentMethodSourceHandle } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { ThreeDSecurePopup } from "@src/components/shared/PaymentMethodForm/ThreeDSecurePopup";
import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
import { handleStripeError } from "@src/utils/stripeErrorHandler";

/** Smallest credit purchase Stripe accepts; mirrors the `min` on the custom-amount input. */
const MIN_AMOUNT = 20;

/** Sentinel Select value for entering a new card instead of charging a saved method. */
const NEW_CARD = "new";

export const DEPENDENCIES = {
  AddCreditsAmountFields,
  AddCreditsNewPaymentMethodFields,
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
  useWallet,
  use3DSecure,
  useUser,
  getPaymentMethodDisplay,
  handleStripeError
};

interface AddCreditsFormProps {
  onDone: (amount: number, organization?: string) => void;
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
 * onDone.
 */
export function AddCreditsForm({ onDone, isWalletReady = true, onProcessingChange, dependencies: d = DEPENDENCIES }: AddCreditsFormProps) {
  const { data: setupIntent, mutate: createSetupIntent, status: setupIntentStatus } = d.useSetupIntentMutation();
  const { user } = d.useUser();
  const { pollForPayment, isPolling } = d.usePaymentPolling();
  const { isTrialing } = d.useWallet();
  const { data: paymentMethods, isLoading: isLoadingMethods } = d.usePaymentMethodsQuery();
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
  const wasPollingRef = useRef<boolean>(false);

  const amount = useMemo(() => Number(amountInput.predefinedAmount || amountInput.customAmount) || 0, [amountInput.predefinedAmount, amountInput.customAmount]);
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

    if (!user?.id || amount < MIN_AMOUNT) {
      return;
    }

    setError(null);
    setErrorAction(null);
    setIsProcessing(true);

    let paymentMethodId = selectedMethodId;
    let organization: string | undefined;

    if (isNewCard) {
      const paymentMethod = await paymentMethodRef.current?.addPaymentMethod();
      if (!paymentMethod) {
        setIsProcessing(false);
        return;
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

  const finalizeFailure = useCallback((message: string, userAction?: string | null) => {
    setCharge(null);
    setIsProcessing(false);
    setError(message);
    setErrorAction(userAction ?? null);
  }, []);

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
      if (!charge || charge.status !== "pending" || charge.amount < MIN_AMOUNT || !isWalletReady) return;

      setCharge({ ...charge, status: "charging" });
      void performCharge(charge);
    },
    [charge, isWalletReady, performCharge]
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

      setCharge(null);
      setIsProcessing(false);
      onDone(charge.amount, charge.organization);
    },
    [isPolling, isTrialing, charge, finalizeFailure, onDone]
  );

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isProcessing);
    },
    [isProcessing, onProcessingChange]
  );

  return (
    <>
      {isTrialing && (
        <Alert variant="default" className="bg-blue-50 p-3 dark:bg-blue-950">
          <GiftIcon className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">First-purchase match.</AlertTitle>
          <AlertDescription className="text-muted-foreground">Akash matches your first purchase dollar-dollar, up to $100.</AlertDescription>
        </Alert>
      )}

      <form className="space-y-6" onSubmit={submit}>
        <d.AddCreditsAmountFields value={amountInput} onChange={setAmountInput} />

        {isLoadingMethods ? (
          <d.Skeleton className="h-10 w-full" />
        ) : (
          !!paymentMethods?.length && (
            <div className="space-y-2">
              <d.Label htmlFor="add-credits-payment-method">Payment method</d.Label>
              <d.Select value={selectedMethodId ?? ""} onValueChange={setSelectedMethodId}>
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

        <Button type="submit" className="w-full space-x-2" disabled={isProcessing || amount < MIN_AMOUNT || isLoadingMethods || (isNewCard && isSetupLoading)}>
          {isProcessing && <Spinner size="small" />}
          Purchase Credits
        </Button>
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
