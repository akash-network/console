import React, { useState } from "react";
import { Alert, Button, Input } from "@akashnetwork/ui/components";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
}

export const AddPaymentMethodForm: React.FC<AddPaymentMethodFormProps> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");
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
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: cardholderName
            }
          }
        },
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        id="cardholderName"
        type="text"
        value={cardholderName}
        onChange={e => setCardholderName(e.target.value)}
        placeholder="Name on card"
        required
        label="Cardholder Name"
      />
      <PaymentElement />
      {error && (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Add Card"}
      </Button>
    </form>
  );
};
