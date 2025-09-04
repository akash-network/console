"use client";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@akashnetwork/ui/components";
import { CheckCircle, CreditCard } from "iconoir-react";

import { PaymentMethodForm } from "@src/components/shared";
import { Title } from "@src/components/shared/Title";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMethodsQuery, usePaymentMutations } from "@src/queries/usePaymentQueries";
import { handleStripeError } from "@src/utils/stripeErrorHandler";

interface PaymentVerificationCardProps {
  setupIntent: any;
  onSuccess: () => void;
}

export const PaymentVerificationCard: React.FunctionComponent<PaymentVerificationCardProps> = ({ setupIntent, onSuccess }) => {
  const { user } = useUser();
  const { testCharge } = usePaymentMutations();
  const { data: currentPaymentMethods = [], refetch: refetchPaymentMethods } = usePaymentMethodsQuery({
    enabled: !!user?.stripeCustomerId
  });

  const [cardAdded, setCardAdded] = useState(false);
  const [cardValidated, setCardValidated] = useState(false);
  const [validatingCard, setValidatingCard] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const [addedPaymentMethodId, setAddedPaymentMethodId] = useState<string>("");

  // Watch for newly added payment methods and automatically validate them
  useEffect(() => {
    if (cardAdded && currentPaymentMethods.length > 0 && !addedPaymentMethodId) {
      // Get the most recently added payment method
      const latestPaymentMethod = currentPaymentMethods[0];
      setAddedPaymentMethodId(latestPaymentMethod.id);

      // Automatically start the test charge validation
      handleTestCharge(latestPaymentMethod.id);
    }
  }, [cardAdded, currentPaymentMethods, addedPaymentMethodId]);

  const handleCardAdded = async () => {
    setCardAdded(true);
    setValidationError("");
    // Refetch payment methods to get the newly added one
    if (user?.stripeCustomerId) {
      await refetchPaymentMethods();
    }
  };

  const handleTestCharge = async (paymentMethodId: string) => {
    if (!user?.id || !paymentMethodId) return;

    setValidatingCard(true);
    setValidationError("");

    try {
      await testCharge.mutateAsync({
        userId: user.id,
        paymentMethodId: paymentMethodId
      });

      setCardValidated(true);
      // Wait a moment to show success state before proceeding
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: unknown) {
      console.error("Test charge failed:", error);
      const errorInfo = handleStripeError(error);
      setValidationError(errorInfo.message);
      setValidatingCard(false);
    }
  };

  const resetToAddCard = () => {
    setCardAdded(false);
    setCardValidated(false);
    setValidationError("");
    setAddedPaymentMethodId("");
  };

  // Render payment form states
  if (cardValidated) {
    return (
      <div className="space-y-6 text-center">
        <Title>Add Payment Method</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Card Validated Successfully!</h3>
            <p className="text-muted-foreground">Your payment method has been verified. Proceeding to next step...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cardAdded && validatingCard) {
    return (
      <div className="space-y-6 text-center">
        <Title>Add Payment Method</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <Spinner className="h-16 w-16 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Validating Your Card</h3>
            <p className="text-muted-foreground">We're performing a $1 test charge to verify your card is valid. This will be immediately refunded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="space-y-6 text-center">
        <Title>Add Payment Method</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="space-y-4 py-8">
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>

            <div className="text-center">
              <p className="mb-4 text-sm text-muted-foreground">Your card could not be validated. Please check your card details and try again.</p>
              <Button onClick={resetToAddCard} variant="ghost" className="text-sm text-primary hover:underline">
                Try a different card
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render payment form
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
            <div className="text-sm text-muted-foreground">
              Your payment method will be used for identity verification.{" "}
              <span className="font-bold text-primary-foreground">A $1 test charge will be made and immediately refunded to validate your card.</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupIntent?.clientSecret && <PaymentMethodForm onSuccess={handleCardAdded} buttonText="Add Payment Method" processingText="Processing..." />}
        </CardContent>
      </Card>
    </div>
  );
};
