import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";

import { PaymentMethodsList } from "@src/components/shared/PaymentMethodsList";
import { Title } from "@src/components/shared/Title";
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
  walletError?: AppError;
  hasPaymentMethod: boolean;
}

export const PaymentMethodsDisplay: React.FC<PaymentMethodsDisplayProps> = ({
  paymentMethods,
  onRemovePaymentMethod,
  onStartTrial,
  isLoading,
  isRemoving,
  walletError,
  hasPaymentMethod
}) => {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-md">
        <Title className="mb-4 text-center" subTitle>
          Your Payment Method
        </Title>

        {paymentMethods.length === 0 ? (
          <EmptyPaymentMethods />
        ) : (
          <PaymentMethodsList paymentMethods={paymentMethods} isRemoving={isRemoving} onRemovePaymentMethod={onRemovePaymentMethod} />
        )}
      </div>

      <ErrorAlert error={walletError} />

      <TrialStartButton isLoading={isLoading} disabled={!hasPaymentMethod || isLoading} onClick={onStartTrial} />

      <TermsAndConditions />
    </div>
  );
};
