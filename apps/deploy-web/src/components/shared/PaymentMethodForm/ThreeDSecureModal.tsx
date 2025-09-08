"use client";
import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle, Shield, WarningTriangle } from "iconoir-react";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

interface ThreeDSecureModalProps {
  clientSecret: string;
  paymentIntentId?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  successMessage?: string;
  errorMessage?: string;
  hideTitle?: boolean;
}

const ThreeDSecureForm: React.FC<Omit<ThreeDSecureModalProps, "isOpen" | "onClose">> = ({
  clientSecret,
  paymentIntentId: _paymentIntentId,
  onSuccess,
  onError,
  title: _title = "Card Authentication",
  description = "Your bank requires additional verification for this transaction.",
  successMessage = "Your card has been verified successfully.",
  errorMessage = "Please try again or use a different payment method.",
  hideTitle = false
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"processing" | "succeeded" | "failed">("processing");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const authenticationInProgress = useRef(false);

  useEffect(() => {
    if (!stripe || !elements || status !== "processing") {
      return;
    }

    const handleAuthentication = async () => {
      // Prevent multiple simultaneous authentication attempts
      if (authenticationInProgress.current) {
        console.log("Authentication already in progress, skipping...");
        return;
      }

      authenticationInProgress.current = true;

      try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);

        console.log("3D Secure authentication result:", { error, paymentIntent });

        if (error) {
          console.error("3D Secure authentication error:", error);
          setStatus("failed");
          const errorMessage = error.message || "Authentication failed";
          setErrorMsg(errorMessage);
          onError(errorMessage);
        } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
          console.log("3D Secure authentication successful, status:", paymentIntent.status);
          setStatus("succeeded");
          setTimeout(() => {
            onSuccess();
          }, 1500);
        } else if (paymentIntent && paymentIntent.status === "requires_payment_method") {
          console.error("3D Secure authentication failed - payment method declined");
          setStatus("failed");
          const errorMessage = "Your payment method was declined. Please try a different card.";
          setErrorMsg(errorMessage);
          onError(errorMessage);
        } else {
          console.error("3D Secure authentication failed, unexpected status:", paymentIntent?.status);
          setStatus("failed");
          const errorText = `Authentication failed. Status: ${paymentIntent?.status || "unknown"}`;
          setErrorMsg(errorText);
          onError(errorText);
        }
      } catch (err) {
        console.error("3D Secure authentication exception:", err);
        setStatus("failed");
        const errorText = err instanceof Error ? err.message : "Authentication failed due to an unexpected error";
        setErrorMsg(errorText);
        onError(errorText);
      } finally {
        authenticationInProgress.current = false;
      }
    };

    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (status === "processing") {
        setStatus("failed");
        const errorMessage = "Authentication timed out. Please try again.";
        setErrorMsg(errorMessage);
        onError(errorMessage);
      }
    }, 30000); // 30 second timeout

    handleAuthentication();

    return () => {
      clearTimeout(timeout);
      authenticationInProgress.current = false;
    };
  }, [stripe, elements, clientSecret, onSuccess, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "succeeded") {
    return (
      <div className="py-8 text-center">
        <div className="mb-4 flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Authentication Successful!</h3>
        <p className="text-muted-foreground">{successMessage}</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="mb-4 flex justify-center">
          <WarningTriangle className="h-16 w-16 text-red-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Authentication Failed</h3>
        <p className="text-muted-foreground">{errorMsg}</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      {!hideTitle && (
        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Secure Authentication</h3>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">Please complete the authentication process to continue.</p>
        </div>
      )}
      <div className="mb-4 flex justify-center">
        <Spinner className="h-16 w-16 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Processing Authentication</h3>
      <p className="text-muted-foreground">Please wait while we verify your card with your bank...</p>
    </div>
  );
};

export const ThreeDSecureModal: React.FC<ThreeDSecureModalProps> = ({
  clientSecret,
  paymentIntentId,
  onSuccess,
  onError,
  isOpen,
  onClose: _onClose,
  title = "Card Authentication",
  description = "Your bank requires additional verification for this transaction.",
  successMessage = "Your card has been verified successfully.",
  errorMessage = "Please try again or use a different payment method.",
  hideTitle = false
}) => {
  const { stripeService } = useServices();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const stripePromise = stripeService.getStripe();

  if (!isOpen) {
    return null;
  }

  if (!stripePromise) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Payment processing is not available at this time. Please try again later.</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: isDarkMode ? "night" : "stripe",
          variables: {
            colorPrimary: "#ff424c",
            colorSuccess: "#ff424c"
          }
        }
      }}
    >
      <ThreeDSecureForm
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        onSuccess={onSuccess}
        onError={onError}
        title={title}
        description={description}
        successMessage={successMessage}
        errorMessage={errorMessage}
        hideTitle={hideTitle}
      />
    </Elements>
  );
};
