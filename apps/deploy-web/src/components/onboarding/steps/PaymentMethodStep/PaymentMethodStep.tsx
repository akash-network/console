"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Popup } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";
import { Check, CreditCard, Trash } from "iconoir-react";
import { useTheme } from "next-themes";

import { PaymentMethodForm } from "@src/components/shared";
import { Title } from "@src/components/shared/Title";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import { getStripe } from "@src/utils/stripeUtils";

interface PaymentMethodStepProps {
  onComplete: () => void;
}

export const PaymentMethodStep: React.FunctionComponent<PaymentMethodStepProps> = ({ onComplete }) => {
  const stripePromise = useMemo(() => getStripe(), []);
  const { data: setupIntent, mutate: createSetupIntent } = useSetupIntentMutation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const { data: paymentMethods = [], refetch: refetchPaymentMethods } = usePaymentMethodsQuery();
  const { removePaymentMethod } = usePaymentMutations();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();

  useEffect(() => {
    if (!setupIntent) {
      createSetupIntent();
    }
  }, [setupIntent, createSetupIntent]);

  const handleSuccess = () => {
    setShowAddForm(false);
    refetchPaymentMethods();
    onComplete();
  };

  const handleRemovePaymentMethod = (paymentMethodId: string) => {
    setCardToDelete(paymentMethodId);
    setShowDeleteConfirmation(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!cardToDelete) return;

    try {
      await removePaymentMethod.mutateAsync(cardToDelete);
    } catch (error) {
      console.error("Failed to remove payment method:", error);
    } finally {
      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
    }
  };

  const formatCardNumber = (last4: string) => `•••• •••• •••• ${last4}`;

  const formatExpiry = (expMonth: number, expYear: number) => {
    const month = expMonth.toString().padStart(2, "0");
    const year = expYear.toString().slice(-2);
    return `${month}/${year}`;
  };

  return (
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>
      <p className="text-muted-foreground">Add a payment method to verify your identity and continue with your free trial.</p>

      {paymentMethods.length === 0 && !showAddForm && (
        <Alert className="mx-auto max-w-md">
          <CreditCard className="h-4 w-4" />
          <div>
            <h4 className="font-medium">Payment Method Required</h4>
            <p className="text-sm">You must add a payment method to continue to the next step.</p>
          </div>
        </Alert>
      )}

      {paymentMethods.length > 0 && !showAddForm && (
        <div className="space-y-4">
          <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="success">
            <div className="rounded-full bg-card p-3">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-medium">Payment Method Added</h4>
              <p className="text-sm">Your payment method has been successfully added.</p>
            </div>
          </Alert>

          <Card className="mx-auto max-w-md">
            <CardHeader className="flex flex-row items-center gap-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="m-0">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-left">
                        <div className="font-medium">{method.card ? formatCardNumber(method.card.last4) : "Payment Method"}</div>
                        <div className="text-sm text-muted-foreground">
                          {method.card ? `${method.card.brand} • Expires ${formatExpiry(method.card.exp_month, method.card.exp_year)}` : "N/A"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      disabled={removePaymentMethod.isPending}
                      className="hover:text-muted-foreground"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(paymentMethods.length === 0 || showAddForm) && (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>Payment Verification</CardTitle>
            <CardDescription>We need to verify your identity to provide you with the best service.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your payment method will be used for identity verification. No charges will be made during your free trial.
            </p>

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
                    <PaymentMethodForm onSuccess={handleSuccess} buttonText="Add Payment Method" processingText="Processing..." />
                  </Elements>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    Payment processing is not available at this time. Please try again later or contact support if the issue persists.
                  </div>
                )}
              </ErrorBoundary>
            )}
          </CardContent>
        </Card>
      )}

      <Popup
        open={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setCardToDelete(undefined);
        }}
        title="Remove Payment Method"
        variant="custom"
        actions={[
          {
            label: "Cancel",
            variant: "ghost",
            onClick: () => {
              setShowDeleteConfirmation(false);
              setCardToDelete(undefined);
            },
            side: "left"
          },
          {
            label: "Remove",
            onClick: confirmRemovePaymentMethod,
            variant: "default",
            disabled: removePaymentMethod.isPending,
            side: "right"
          }
        ]}
      >
        <p>Are you sure you want to remove this payment method?</p>
      </Popup>
    </div>
  );
};
