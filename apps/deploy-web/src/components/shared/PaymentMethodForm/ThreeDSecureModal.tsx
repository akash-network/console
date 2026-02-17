"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle, Shield, WarningTriangle } from "iconoir-react";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

const SUCCESS_DELAY = 1_500;
const SUCCESSFUL_STATUSES = ["succeeded", "requires_capture", "processing"] as const;

interface ThreeDSecureModalProps {
  clientSecret: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  title?: string;
  description?: string;
  successMessage?: string;
  errorMessage?: string;
  hideTitle?: boolean;
}

type AuthenticationStatus = "processing" | "succeeded" | "failed";

interface StripeError {
  message?: string;
  type?: string;
  code?: string;
}

interface PaymentIntent {
  status: string;
  id: string;
}

interface AuthenticationResult {
  error?: StripeError;
  paymentIntent?: PaymentIntent;
}

const ThreeDSecureForm: React.FC<Omit<ThreeDSecureModalProps, "isOpen" | "onClose">> = ({
  clientSecret,
  paymentIntentId: _paymentIntentId,
  paymentMethodId,
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
  const [status, setStatus] = useState<AuthenticationStatus>("processing");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const authenticationInProgress = useRef(false);

  const handleAuthenticationFailure = useCallback(
    (message: string) => {
      setStatus("failed");
      setErrorMsg(message);
      onError(message);
    },
    [onError]
  );

  const handleAuthenticationSuccess = useCallback(
    (paymentIntentStatus: string) => {
      console.log("3D Secure authentication successful, status:", paymentIntentStatus);
      setStatus("succeeded");
      setTimeout(() => {
        onSuccess();
      }, SUCCESS_DELAY);
    },
    [onSuccess]
  );

  const processAuthenticationResult = useCallback(
    (result: AuthenticationResult) => {
      const { error, paymentIntent } = result;

      if (error) {
        console.error("3D Secure authentication error:", error);
        const errorMessage = error.message || "Authentication failed";
        handleAuthenticationFailure(errorMessage);
        return;
      }

      if (!paymentIntent) {
        console.error("3D Secure authentication failed - no payment intent");
        handleAuthenticationFailure("Authentication failed. Please try again.");
        return;
      }

      if (SUCCESSFUL_STATUSES.includes(paymentIntent.status as (typeof SUCCESSFUL_STATUSES)[number])) {
        handleAuthenticationSuccess(paymentIntent.status);
      } else if (paymentIntent.status === "requires_payment_method") {
        console.error("3D Secure authentication failed - payment method declined");
        const errorMessage = "Your payment method was declined. Please try a different card.";
        handleAuthenticationFailure(errorMessage);
      } else {
        console.error("3D Secure authentication failed, unexpected status:", paymentIntent.status);
        const errorText = `Authentication failed. Status: ${paymentIntent.status || "unknown"}`;
        handleAuthenticationFailure(errorText);
      }
    },
    [handleAuthenticationFailure, handleAuthenticationSuccess]
  );

  const performAuthentication = useCallback(async () => {
    if (!stripe || authenticationInProgress.current) {
      if (authenticationInProgress.current) {
        console.log("Authentication already in progress, skipping...");
      }
      return;
    }

    authenticationInProgress.current = true;

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodId
      });
      console.log("3D Secure authentication result:", result);
      processAuthenticationResult(result);
    } catch (err) {
      console.error("3D Secure authentication exception:", err);
      const errorText = err instanceof Error ? err.message : "Authentication failed due to an unexpected error";
      handleAuthenticationFailure(errorText);
    } finally {
      authenticationInProgress.current = false;
    }
  }, [stripe, clientSecret, paymentMethodId, processAuthenticationResult, handleAuthenticationFailure]);

  useEffect(() => {
    if (!stripe || !elements || status !== "processing") {
      return;
    }

    performAuthentication();

    return () => {
      authenticationInProgress.current = false;
    };
  }, [stripe, elements, status, performAuthentication, handleAuthenticationFailure]);

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
          <h3 className="mb-2 text-lg font-semibold">Secure Verification</h3>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">This is a standard security step required by your bank.</p>
        </div>
      )}
      <div className="mb-4 flex justify-center">
        <Spinner className="h-16 w-16 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Verifying with Your Bank</h3>
      <p className="text-muted-foreground">This only takes a moment...</p>
    </div>
  );
};

export const ThreeDSecureModal: React.FC<ThreeDSecureModalProps> = ({
  clientSecret,
  paymentIntentId,
  paymentMethodId,
  onSuccess,
  onError,
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

  if (!stripePromise) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Payment processing is not available at this time. Please try again later.</p>
      </div>
    );
  }

  if (!clientSecret || clientSecret.trim() === "") {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Authentication data is missing. Please try again.</p>
      </div>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: isDarkMode ? "night" : "stripe",
          variables: {
            colorPrimary: isDarkMode ? "#e3e3e3" : "#171717",
            colorSuccess: "#16a34a"
          }
        }
      }}
    >
      <ThreeDSecureForm
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        paymentMethodId={paymentMethodId}
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
