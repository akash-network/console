import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import { useValidatedPaymentMethods } from "@src/hooks/useValidatedPaymentMethods";
import type { AppError } from "@src/types";
import { EmptyPaymentMethods } from "./EmptyPaymentMethods";
import { ErrorAlert } from "./ErrorAlert";
import { PaymentMethodsList } from "./PaymentMethodsList";
import { TermsAndConditions } from "./TermsAndConditions";
import { TrialStartButton } from "./TrialStartButton";
import { ValidationWarning } from "./ValidationWarning";

interface PaymentMethodsDisplayProps {
  paymentMethods: PaymentMethod[];
  onRemovePaymentMethod: (paymentMethodId: string) => void;
  onStartTrial: () => void;
  isLoading: boolean;
  isRemoving: boolean;
  managedWalletError?: AppError;
}

export const PaymentMethodsDisplay: React.FC<PaymentMethodsDisplayProps> = ({
  paymentMethods,
  onRemovePaymentMethod,
  onStartTrial,
  isLoading,
  isRemoving,
  managedWalletError
}) => {
  const { data: validatedPaymentMethods = [] } = useValidatedPaymentMethods();
  const hasValidatedCard = validatedPaymentMethods.length > 0;

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-md">
        <h3 className="mb-4 text-center text-lg font-semibold">Your Payment Methods</h3>

        {paymentMethods.length === 0 ? (
          <EmptyPaymentMethods />
        ) : (
          <PaymentMethodsList
            paymentMethods={paymentMethods}
            validatedPaymentMethods={validatedPaymentMethods}
            isRemoving={isRemoving}
            onRemovePaymentMethod={onRemovePaymentMethod}
          />
        )}
      </div>

      <ErrorAlert error={managedWalletError} />

      <TrialStartButton isLoading={isLoading} disabled={paymentMethods.length === 0 || !hasValidatedCard} onClick={onStartTrial} />

      <ValidationWarning show={paymentMethods.length > 0 && !hasValidatedCard} />

      <TermsAndConditions />
    </div>
  );
};
