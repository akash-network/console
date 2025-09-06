"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@akashnetwork/ui/components";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle, Shield, WarningTriangle } from "iconoir-react";
import { useTheme } from "next-themes";

import { Title } from "@src/components/shared/Title";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

interface ThreeDSecureAuthProps {
  clientSecret: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const ThreeDSecureForm: React.FC<ThreeDSecureAuthProps> = ({ clientSecret, paymentIntentId: _paymentIntentId, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"processing" | "succeeded" | "failed">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!stripe || !elements) {
      return;
    }

    const handleAuthentication = async () => {
      try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);

        console.log("3D Secure authentication result:", { error, paymentIntent });

        if (error) {
          console.error("3D Secure authentication error:", error);
          setStatus("failed");
          setErrorMessage(error.message || "Authentication failed");
          onError(error.message || "Authentication failed");
        } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
          console.log("3D Secure authentication successful, status:", paymentIntent.status);
          setStatus("succeeded");
          setTimeout(() => {
            onSuccess();
          }, 1500);
        } else {
          console.error("3D Secure authentication failed, unexpected status:", paymentIntent?.status);
          setStatus("failed");
          setErrorMessage(`Authentication failed. Status: ${paymentIntent?.status || "unknown"}`);
          onError(`Authentication failed. Status: ${paymentIntent?.status || "unknown"}`);
        }
      } catch (err) {
        console.error("3D Secure authentication exception:", err);
        setStatus("failed");
        const errorMsg = err instanceof Error ? err.message : "Authentication failed";
        setErrorMessage(errorMsg);
        onError(errorMsg);
      }
    };

    handleAuthentication();
  }, [stripe, elements, clientSecret, onSuccess, onError]);

  if (status === "succeeded") {
    return (
      <div className="space-y-6 text-center">
        <Title>Card Authentication</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Authentication Successful!</h3>
            <p className="text-muted-foreground">Your card has been verified. Proceeding to start your trial...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-6 text-center">
        <Title>Card Authentication</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="space-y-4 py-8">
            <div className="mb-4 flex justify-center">
              <WarningTriangle className="h-16 w-16 text-red-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Authentication Failed</h3>
            <p className="text-muted-foreground">{errorMessage}</p>
            <p className="text-sm text-muted-foreground">Please try again or use a different payment method.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <Title>Card Authentication</Title>
      <Card className="mx-auto max-w-md text-left">
        <CardHeader className="mb-2">
          <div className="mb-4 flex flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Secure Authentication</CardTitle>
          </div>
          <CardDescription className="space-y-2">
            <div>Your bank requires additional verification for this transaction.</div>
            <div className="text-sm text-muted-foreground">Please complete the authentication process to continue with your trial.</div>
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <div className="mb-4 flex justify-center">
            <Spinner className="h-16 w-16 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Processing Authentication</h3>
          <p className="text-muted-foreground">Please wait while we verify your card with your bank...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export const ThreeDSecureAuth: React.FC<ThreeDSecureAuthProps> = props => {
  const { stripeService } = useServices();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const stripePromise = stripeService.getStripe();

  if (!stripePromise) {
    return (
      <div className="space-y-6 text-center">
        <Title>Card Authentication</Title>
        <Card className="mx-auto max-w-md text-left">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Payment processing is not available at this time. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: isDarkMode ? "night" : "stripe",
          variables: {
            colorPrimary: "#ff424c",
            colorSuccess: "#ff424c"
          }
        }
      }}
    >
      <ThreeDSecureForm {...props} />
    </Elements>
  );
};
