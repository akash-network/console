"use client";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

import { PaymentMethodForm } from "@src/components/shared";
import { Title } from "@src/components/shared/Title";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery } from "@src/queries/usePaymentQueries";

interface PaymentVerificationCardProps {
  setupIntent: { clientSecret: string };
  onSuccess: () => void;
}

export const PaymentVerificationCard: React.FunctionComponent<PaymentVerificationCardProps> = ({ setupIntent, onSuccess }) => {
  const { user } = useUser();
  const { refetch: refetchPaymentMethods } = usePaymentMethodsQuery({
    enabled: !!user?.stripeCustomerId
  });

  const handleCardAdded = async () => {
    if (user?.stripeCustomerId) {
      await refetchPaymentMethods();
    }
    onSuccess();
  };

  return (
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>
      <Card className="mx-auto max-w-md text-left">
        <CardHeader className="mb-2">
          <div className="mb-4 flex flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Add Payment Method</CardTitle>
          </div>
          <CardDescription className="space-y-2">
            <div>We need to verify your identity to provide you with the best service.</div>
            <div className="text-sm text-muted-foreground">Your payment method will be used for identity verification during the trial start process.</div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupIntent?.clientSecret && <PaymentMethodForm onSuccess={handleCardAdded} buttonText="Add Payment Method" processingText="Processing..." />}
        </CardContent>
      </Card>
    </div>
  );
};
