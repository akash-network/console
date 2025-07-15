"use client";
import React, { useEffect, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";
import { CreditCard } from "iconoir-react";
import { useTheme } from "next-themes";

import { PaymentMethodForm } from "@src/components/shared";
import { Title } from "@src/components/shared/Title";
import { useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import { getStripe } from "@src/utils/stripeUtils";

interface PaymentMethodStepProps {
  onComplete: () => void;
}

export const PaymentMethodStep: React.FunctionComponent<PaymentMethodStepProps> = ({ onComplete }) => {
  const stripePromise = useMemo(() => getStripe(), []);
  const { data: setupIntent, mutate: createSetupIntent } = useSetupIntentMutation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    if (!setupIntent) {
      createSetupIntent();
    }
  }, [setupIntent, createSetupIntent]);

  const handleSuccess = () => {
    onComplete();
  };

  return (
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>
      <p className="text-muted-foreground">Add a payment method to verify your identity and continue with your free trial.</p>

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
    </div>
  );
};
