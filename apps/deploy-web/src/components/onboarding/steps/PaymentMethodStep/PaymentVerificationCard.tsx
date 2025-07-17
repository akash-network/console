"use client";
import React, { useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Elements } from "@stripe/react-stripe-js";
import { CreditCard } from "iconoir-react";
import { useTheme } from "next-themes";

import { PaymentMethodForm } from "@src/components/shared";
import { getStripe } from "@src/utils/stripeUtils";

interface PaymentVerificationCardProps {
  setupIntent?: { clientSecret: string };
  onSuccess: () => void;
}

export const PaymentVerificationCard: React.FunctionComponent<PaymentVerificationCardProps> = ({ setupIntent, onSuccess }) => {
  const stripePromise = useMemo(() => getStripe(), []);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <Card className="mx-auto max-w-md text-left">
      <CardHeader className="mb-2">
        <div className="mb-4 flex flex-row items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Payment Verification</CardTitle>
        </div>
        <CardDescription className="space-y-2">
          <p>We need to verify your identity to provide you with the best service.</p>
          <p className="text-sm text-muted-foreground">
            Your payment method will be used for identity verification.{" "}
            <span className="font-bold text-primary-foreground">No charges will be made during your free trial.</span>
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <PaymentMethodForm onSuccess={onSuccess} buttonText="Add Payment Method" processingText="Processing..." />
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
  );
};
