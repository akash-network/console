"use client";
import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Alert, AlertDescription, AlertTitle, Popup } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import type { AppError } from "@src/types";
import { PaymentMethodsDisplay } from "../PaymentMethodsDisplay/PaymentMethodsDisplay";
import { PaymentVerificationCard } from "../PaymentVerificationCard/PaymentVerificationCard";

interface PaymentMethodStepProps {
  setupIntent: SetupIntentResponse | undefined;
  paymentMethods: PaymentMethod[];
  showAddForm: boolean;
  showDeleteConfirmation: boolean;
  cardToDelete?: string;
  isLoading: boolean;
  isRemoving: boolean;
  managedWalletError?: AppError;
  onSuccess: () => void;
  onRemovePaymentMethod: (paymentMethodId: string) => void;
  onConfirmRemovePaymentMethod: () => Promise<void>;
  onNext: () => void;
  onShowDeleteConfirmation: (show: boolean) => void;
  onSetCardToDelete: (cardId?: string) => void;
}

export const PaymentMethodStep: React.FunctionComponent<PaymentMethodStepProps> = ({
  setupIntent,
  paymentMethods,
  showAddForm,
  showDeleteConfirmation,
  cardToDelete: _cardToDelete,
  isLoading,
  isRemoving,
  managedWalletError,
  onSuccess,
  onRemovePaymentMethod,
  onConfirmRemovePaymentMethod,
  onNext,
  onShowDeleteConfirmation,
  onSetCardToDelete
}) => {
  return (
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>

      {paymentMethods.length > 0 && !showAddForm && (
        <PaymentMethodsDisplay
          paymentMethods={paymentMethods}
          onRemovePaymentMethod={onRemovePaymentMethod}
          onStartTrial={onNext}
          isLoading={isLoading}
          isRemoving={isRemoving}
          managedWalletError={managedWalletError}
        />
      )}

      {(paymentMethods.length === 0 || showAddForm) && <PaymentVerificationCard setupIntent={setupIntent} onSuccess={onSuccess} />}

      {paymentMethods.length === 0 && !showAddForm && (
        <Alert className="mx-auto max-w-md text-left" variant="warning">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-card p-3">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription>You must add a payment method to continue to the next step.</AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      <Popup
        open={showDeleteConfirmation}
        onClose={() => {
          onShowDeleteConfirmation(false);
          onSetCardToDelete(undefined);
        }}
        title="Remove Payment Method"
        variant="custom"
        actions={[
          {
            label: "Cancel",
            variant: "ghost",
            onClick: () => {
              onShowDeleteConfirmation(false);
              onSetCardToDelete(undefined);
            },
            side: "left"
          },
          {
            label: "Remove",
            onClick: onConfirmRemovePaymentMethod,
            variant: "default",
            disabled: isRemoving,
            side: "right"
          }
        ]}
      >
        <p>Are you sure you want to remove this payment method?</p>
      </Popup>
    </div>
  );
};
