"use client";
import React, { useState } from "react";
import { Alert, Button } from "@akashnetwork/ui/components";
import { AddressElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

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
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [organization, setOrganization] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("card");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required"
      });

      if (result.error) {
        if (selectedType === "link") {
          setError("Unable to set up Link as a payment method. Please try using a debit or credit card instead.");
        } else {
          setError(result.error.message || "An error occurred while processing your payment method.");
        }
        return;
      }

      if (result.setupIntent?.status === "succeeded") {
        onSuccess(organization.trim() || undefined);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
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
          onReady={onReady}
          onChange={e => setSelectedType(e.value.type)}
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
