"use client";
import React from "react";
import type { SetupIntentResponse } from "@akashnetwork/http-sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CreditCard, Shield } from "iconoir-react";

import { PaymentMethodForm } from "@src/components/shared";
import { Title } from "@src/components/shared/Title";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";

interface PaymentVerificationCardProps {
  setupIntent?: Pick<SetupIntentResponse, "clientSecret">;
  onSuccess: (organization?: string) => void;
}

export const PaymentVerificationCard: React.FunctionComponent<PaymentVerificationCardProps> = ({ setupIntent, onSuccess }) => {
  const { user } = useUser();
  const { refetch: refetchPaymentMethods } = usePaymentMethodsQuery({
    enabled: !!user?.stripeCustomerId
  });

  const handleCardAdded = async (organization?: string) => {
    if (user?.stripeCustomerId) {
      await refetchPaymentMethods();
    }
    onSuccess(organization);
  };

  if (!setupIntent) {
    return (
      <div className="space-y-6 text-center">
        <Title>Add Payment Method</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>Loading payment form...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <Card className="mx-auto max-w-md text-left">
        <CardHeader className="mb-2">
          <div className="mb-4 flex flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Verify to Unlock $100 in Free Credits</CardTitle>
          </div>
          <CardDescription className="space-y-2">
            <div>Add a payment method to verify your identity and start deploying. You won&apos;t be charged during your free trial.</div>
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              <Shield className="h-4 w-4 shrink-0" />
              <span>Secured by Stripe. Your card details are encrypted and never stored on our servers.</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentMethodForm onSuccess={handleCardAdded} buttonText="Add Payment Method" processingText="Processing..." />
        </CardContent>
      </Card>
    </div>
  );
};
