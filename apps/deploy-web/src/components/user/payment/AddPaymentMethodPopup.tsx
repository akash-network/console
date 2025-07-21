import React, { useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Popup } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";

import { PaymentMethodForm } from "@src/components/shared";
import { getStripe } from "@src/utils/stripeUtils";

interface AddPaymentMethodPopupProps {
  open: boolean;
  onClose: () => void;
  clientSecret?: string;
  isDarkMode: boolean;
  onSuccess: () => void;
}

export const AddPaymentMethodPopup: React.FC<AddPaymentMethodPopupProps> = ({ open, onClose, clientSecret, isDarkMode, onSuccess }) => {
  const stripePromise = useMemo(() => getStripe(), []);

  return (
    <Popup open={open} onClose={onClose} title="Add New Payment Method" variant="custom" actions={[]}>
      {clientSecret && (
        <ErrorBoundary fallback={<div>Failed to load payment form</div>}>
          {stripePromise ? (
            <Elements
              stripe={stripePromise}
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
              <PaymentMethodForm onSuccess={onSuccess} buttonText="Add Card" processingText="Processing..." />
            </Elements>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Payment processing is not available at this time. Please try again later or contact support if the issue persists.
            </div>
          )}
        </ErrorBoundary>
      )}
    </Popup>
  );
};
