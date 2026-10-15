"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@akashnetwork/ui/components";
import { Elements, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";

import type { PaymentMethodSourceHandle } from "@src/components/billing-usage/AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { useServices } from "@src/context/ServicesProvider";

export interface WalletPaymentSource extends PaymentMethodSourceHandle {
  type: string;
}

export const DEPENDENCIES = { Elements, PaymentRequestButtonElement, useServices };

interface AddCreditsWalletButtonProps {
  amount: number;
  disabled: boolean;
  onSubmit: (source: WalletPaymentSource) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  dependencies?: typeof DEPENDENCIES;
}

export function AddCreditsWalletButton({ amount, disabled, onSubmit, onOpenChange, dependencies: d = DEPENDENCIES }: AddCreditsWalletButtonProps) {
  const { stripeService, stripe: stripeApi } = d.useServices();
  const stripePromise = useMemo(() => stripeService.getStripe(), [stripeService]);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const callbacks = useRef({ onSubmit, onOpenChange });
  callbacks.current = { onSubmit, onOpenChange };

  useEffect(
    function detectWallet() {
      let disposed = false;
      let request: PaymentRequest | undefined;

      const releaseWallet = () => callbacks.current.onOpenChange(false);
      const authorizeWallet = async (event: PaymentRequestPaymentMethodEvent) => {
        let completed = false;
        const complete = (status: "success" | "fail") => {
          if (completed) return;
          completed = true;
          event.complete(status);
        };

        setError(null);
        try {
          await callbacks.current.onSubmit({
            type: event.paymentMethod.card?.wallet?.type ?? walletType(event.walletName),
            async addPaymentMethod() {
              try {
                const stripe = await stripePromise;
                const { clientSecret } = await stripeApi.createSetupIntent();
                if (!stripe || !clientSecret) throw new Error("Wallet setup unavailable");

                let result = await stripe.confirmCardSetup(clientSecret, { payment_method: event.paymentMethod.id }, { handleActions: false });
                if (result.error) {
                  setError(result.error.message || "Couldn't save your wallet. Please try again.");
                  complete("fail");
                  return null;
                }

                complete("success");
                if (result.setupIntent.status === "requires_action") {
                  result = await stripe.confirmCardSetup(clientSecret);
                }
                if (result.error || result.setupIntent.status !== "succeeded" || typeof result.setupIntent.payment_method !== "string") {
                  setError(result.error?.message || "Wallet authentication did not complete. Please try again.");
                  return null;
                }
                return { paymentMethodId: result.setupIntent.payment_method };
              } catch {
                setError("Couldn't save your wallet. Please check your connection and try again.");
                return null;
              }
            }
          });
        } finally {
          complete("fail");
          releaseWallet();
        }
      };

      void stripePromise
        .then(async stripe => {
          if (!stripe || disposed) return;
          request = stripe.paymentRequest({
            country: "US",
            currency: "usd",
            total: { label: "Akash credits", amount: 0 },
            requestPayerName: true,
            requestPayerEmail: true
          });
          request.on("paymentmethod", authorizeWallet);
          request.on("cancel", releaseWallet);
          const available = await request.canMakePayment();
          if (!disposed && available && Object.values(available).some(Boolean)) setPaymentRequest(request);
        })
        .catch(() => {
          if (!disposed) setPaymentRequest(null);
        });

      return () => {
        disposed = true;
        request?.off("paymentmethod", authorizeWallet);
        request?.off("cancel", releaseWallet);
      };
    },
    [stripePromise, stripeApi]
  );

  if (!paymentRequest) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Express checkout</p>
      <d.Elements stripe={stripePromise}>
        <d.PaymentRequestButtonElement
          options={{ paymentRequest, style: { paymentRequestButton: { type: "buy", height: "44px" } } }}
          onClick={event => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            paymentRequest.update({ total: { label: "Akash credits", amount: Math.round(amount * 100) } });
            callbacks.current.onOpenChange(true);
          }}
        />
      </d.Elements>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-center text-sm text-muted-foreground">Or use a payment method below</p>
    </div>
  );
}

function walletType(name: string) {
  if (name === "applePay") return "apple_pay";
  if (name === "googlePay") return "google_pay";
  if (name === "link") return "link";
  return "card";
}
