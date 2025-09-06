"use client";
import React, { useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { ApiWalletWithOptional3DS } from "@akashnetwork/http-sdk";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Alert, AlertDescription, AlertTitle, Popup } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";
import { CreditCard } from "iconoir-react";
import { useTheme } from "next-themes";

import { Title } from "@src/components/shared/Title";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import type { AppError } from "@src/types";
import { PaymentMethodsDisplay } from "../PaymentMethodsDisplay/PaymentMethodsDisplay";
import { PaymentVerificationCard } from "../PaymentVerificationCard/PaymentVerificationCard";
import { ThreeDSecureAuth } from "../ThreeDSecureAuth/ThreeDSecureAuth";

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
  hasPaymentMethod: boolean;
  threeDSecureData: ApiWalletWithOptional3DS | null;
  on3DSecureSuccess: () => void;
  on3DSecureError: (error: string) => void;
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
  onSetCardToDelete,
  hasPaymentMethod,
  threeDSecureData,
  on3DSecureSuccess,
  on3DSecureError
}) => {
  const { stripeService } = useServices();
  const stripePromise = useMemo(() => stripeService.getStripe(), [stripeService]);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Render 3D Secure authentication if required
  if (threeDSecureData && threeDSecureData.clientSecret && threeDSecureData.paymentIntentId) {
    return (
      <ThreeDSecureAuth
        clientSecret={threeDSecureData.clientSecret}
        paymentIntentId={threeDSecureData.paymentIntentId}
        onSuccess={on3DSecureSuccess}
        onError={on3DSecureError}
      />
    );
  }

  // Render payment form states
  if (paymentMethods.length === 0 || showAddForm) {
    return (
      <div className="space-y-6 text-center">
        {setupIntent?.clientSecret && (
          <ErrorBoundary fallback={<div>Failed to load payment form</div>}>
            {stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: setupIntent.clientSecret,
                  appearance: {
                    theme: isDarkMode ? "night" : "stripe",
                    variables: {
                      colorPrimary: "#ff424c",
                      colorSuccess: "#ff424c"
                    }
                  }
                }}
              >
                <PaymentVerificationCard setupIntent={setupIntent} onSuccess={onSuccess} />
              </Elements>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Payment processing is not available at this time. Please try again later or contact support if the issue persists.
              </div>
            )}
          </ErrorBoundary>
        )}
      </div>
    );
  }

  // Render existing payment methods
  return (
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>

      <PaymentMethodsDisplay
        paymentMethods={paymentMethods}
        onRemovePaymentMethod={onRemovePaymentMethod}
        onStartTrial={onNext}
        isLoading={isLoading}
        isRemoving={isRemoving}
        managedWalletError={managedWalletError}
        hasPaymentMethod={hasPaymentMethod}
      />

      {paymentMethods.length === 0 && !showAddForm && (
        <Alert className="mx-auto max-w-md text-left" variant="warning">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-card p-3">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription>
                You must add a payment method to continue to the next step. Your card will be validated during the trial start process.
              </AlertDescription>
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
