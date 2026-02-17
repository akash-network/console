"use client";
import React, { useCallback, useState } from "react";
import { Alert, Button } from "@akashnetwork/ui/components";
import { AddressElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { StripeInput } from "../StripeInput";

interface PaymentMethodFormProps {
  onSuccess: (organization?: string) => void;
  onReady?: React.ComponentProps<typeof PaymentElement>["onReady"];
  buttonText?: string;
  processingText?: string;
  className?: string;
}

export const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({
  onSuccess,
  onReady,
  buttonText = "Add Card",
  processingText = "Processing...",
  className = ""
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { analyticsService } = useServices();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [organization, setOrganization] = useState<string>("");

  const handleFormReady = useCallback(
    (element: unknown) => {
      analyticsService.track("payment_form_viewed", { category: "onboarding" });
      onReady?.(element as Parameters<NonNullable<typeof onReady>>[0]);
    },
    [analyticsService, onReady]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setError(null);
    setIsProcessing(true);
    analyticsService.track("payment_form_submitted", { category: "onboarding" });

    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required"
      });

      if (result.error) {
        const errorMessage = result.error.message || "An error occurred while processing your payment method.";
        setError(errorMessage);
        analyticsService.track("payment_form_error", {
          category: "onboarding",
          error_type: result.error.type,
          error_code: result.error.code
        });
        return;
      }

      if (result.setupIntent?.status === "succeeded") {
        analyticsService.track("payment_form_success", { category: "onboarding" });
        onSuccess(organization.trim() || undefined);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      analyticsService.track("payment_form_error", {
        category: "onboarding",
        error_type: "unexpected_error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form className={`space-y-6 ${className}`} onSubmit={handleSubmit}>
      {/* Organization Input - Styled to match Stripe Elements */}
      <StripeInput
        id="organization"
        type="text"
        label="Organization (Optional)"
        value={organization}
        onChange={e => setOrganization(e.target.value)}
        autoComplete="organization"
      />

      {/* Billing Address Section */}
      <div className="space-y-4">
        <h3 className="text-left text-sm font-semibold text-muted-foreground">Billing Address</h3>
        <AddressElement
          options={{
            mode: "billing"
          }}
        />
      </div>

      {/* Payment Element */}
      <div className="space-y-2">
        <h3 className="text-left text-sm font-semibold text-muted-foreground">Card Information</h3>
        <PaymentElement
          options={{
            layout: "tabs"
          }}
          onReady={handleFormReady}
        />
      </div>

      {error && (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isProcessing}>
        {isProcessing ? processingText : buttonText}
      </Button>
    </form>
  );
};
