"use client";
import React from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface PaymentMethodStepProps {
  onComplete: () => void;
}

export const PaymentMethodStep: React.FunctionComponent<PaymentMethodStepProps> = ({ onComplete }) => {
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
          <Button onClick={onComplete} className="w-full">
            Add Payment Method
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
