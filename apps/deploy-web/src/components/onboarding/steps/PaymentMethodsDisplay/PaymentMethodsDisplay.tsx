import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import { PaymentMethodsList } from "@src/components/shared/PaymentMethodsList";
import type { AppError } from "@src/types";
import { EmptyPaymentMethods } from "./EmptyPaymentMethods";
import { ErrorAlert } from "./ErrorAlert";
import { TermsAndConditions } from "./TermsAndConditions";
import { TrialStartButton } from "./TrialStartButton";

interface PaymentMethodsDisplayProps {
  paymentMethods: PaymentMethod[];
  onRemovePaymentMethod: (paymentMethodId: string) => void;
  onStartTrial: () => void;
  isLoading: boolean;
  isRemoving: boolean;
  managedWalletError?: AppError;
  hasPaymentMethod: boolean;
}

export const PaymentMethodsDisplay: React.FC<PaymentMethodsDisplayProps> = ({
  paymentMethods,
  onRemovePaymentMethod,
  onStartTrial,
  isLoading,
  isRemoving,
  managedWalletError,
  hasPaymentMethod
}) => {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-md">
        <h3 className="mb-4 text-center text-lg font-semibold">Your Payment Methods</h3>

        {paymentMethods.length === 0 ? (
          <EmptyPaymentMethods />
        ) : (
          <PaymentMethodsList paymentMethods={paymentMethods} isRemoving={isRemoving} onRemovePaymentMethod={onRemovePaymentMethod} />
        )}
      </div>

      <ErrorAlert error={managedWalletError} />

      <TrialStartButton isLoading={isLoading} disabled={!hasPaymentMethod || isLoading} onClick={onStartTrial} />

      <TermsAndConditions />
    </div>
  );
};
