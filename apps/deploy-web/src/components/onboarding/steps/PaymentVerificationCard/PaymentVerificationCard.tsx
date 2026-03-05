"use client";
import React from "react";
import type { SetupIntentResponse } from "@akashnetwork/http-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CreditCard, InfoCircle } from "iconoir-react";

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
        <CardHeader className="mb-2 pb-0">
          <div className="mb-4 flex flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Add Payment Method</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-8 rounded-md border border-blue-500/40 bg-blue-500/10 p-4">
            <div className="flex gap-3">
              <InfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-400">We need to verify your identity before starting your free trial.</p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-blue-300/80">
                  <li>
                    Your card will <strong className="text-blue-300">not</strong> be charged
                  </li>
                  <li>A temporary hold of ~$1 may appear for a few days to verify your identity</li>
                  <li>Virtual and prepaid cards are not accepted</li>
                </ul>
              </div>
            </div>
          </div>
          <PaymentMethodForm onSuccess={handleCardAdded} buttonText="Add Payment Method" processingText="Processing..." />
        </CardContent>
      </Card>
    </div>
  );
};
