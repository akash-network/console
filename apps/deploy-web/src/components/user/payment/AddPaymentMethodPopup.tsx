import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Popup } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { AddPaymentMethodForm } from "./AddPaymentMethodForm";

function getStripe(): Promise<Stripe | null> {
  const publishableKey = browserEnvConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Stripe publishable key is not configured");
  }
  return loadStripe(publishableKey);
}

interface AddPaymentMethodPopupProps {
  open: boolean;
  onClose: () => void;
  clientSecret?: string;
  isDarkMode: boolean;
  onSuccess: () => void;
}

export const AddPaymentMethodPopup: React.FC<AddPaymentMethodPopupProps> = ({ open, onClose, clientSecret, isDarkMode, onSuccess }) => {
  return (
    <Popup open={open} onClose={onClose} title="Add New Payment Method" variant="custom" actions={[]}>
      {clientSecret && (
        <ErrorBoundary fallback={<div>Failed to load payment form</div>}>
          <Elements
            stripe={getStripe()}
            options={{
              clientSecret,
              appearance: {
                theme: isDarkMode ? "night" : "stripe",
                variables: {
                  colorPrimary: "#ff424c",
                  colorSuccess: "#ff424c"
                }
              }
            }}
          >
            <AddPaymentMethodForm onSuccess={onSuccess} />
          </Elements>
        </ErrorBoundary>
      )}
    </Popup>
  );
};
