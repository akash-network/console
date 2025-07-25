"use client";
import React, { useState } from "react";
import { Alert, Button } from "@akashnetwork/ui/components";
import { AddressElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

interface PaymentMethodFormProps {
  onSuccess: () => void;
  buttonText?: string;
  processingText?: string;
  className?: string;
}

export const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({
  onSuccess,
  buttonText = "Add Card",
  processingText = "Processing...",
  className = ""
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required"
      });

      if (setupError) {
        setError(setupError.message || "An error occurred while processing your payment method.");
        return;
      }

      if (setupIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form className={`space-y-6 ${className}`} onSubmit={handleSubmit}>
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
        <PaymentElement />
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
