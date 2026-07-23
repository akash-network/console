"use client";
import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle, Shield, WarningTriangle } from "iconoir-react";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

const SUCCESS_DELAY = 1_500;
const SUCCESSFUL_STATUSES = ["succeeded", "requires_capture", "processing"] as const;

export const DEPENDENCIES = {
  Elements,
  useServices,
  useTheme,
  useStripe,
  useElements
};

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
  dependencies?: typeof DEPENDENCIES;
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
  hideTitle = false,
  dependencies: d = DEPENDENCIES
}) => {
  const stripe = d.useStripe();
  const elements = d.useElements();
  const [status, setStatus] = useState<AuthenticationStatus>("processing");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const hasStartedAuthenticationRef = useRef(false);
  const callbacksRef = useRef({ onSuccess, onError });
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(function trackLatestCallbacks() {
    callbacksRef.current = { onSuccess, onError };
  });

  useEffect(function clearSuccessTimerOnUnmount() {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  useEffect(
    function authenticateOnce() {
      if (!stripe || !elements || hasStartedAuthenticationRef.current) {
        return;
      }
      hasStartedAuthenticationRef.current = true;

      function fail(message: string) {
        setStatus("failed");
        setErrorMsg(message);
        callbacksRef.current.onError(message);
      }

      function succeed() {
        setStatus("succeeded");
        successTimerRef.current = setTimeout(() => callbacksRef.current.onSuccess(), SUCCESS_DELAY);
      }

      function routeResult({ error, paymentIntent }: AuthenticationResult) {
        if (error) {
          fail(error.message || "Authentication failed");
        } else if (!paymentIntent) {
          fail("Authentication failed. Please try again.");
        } else if (SUCCESSFUL_STATUSES.includes(paymentIntent.status as (typeof SUCCESSFUL_STATUSES)[number])) {
          succeed();
        } else if (paymentIntent.status === "requires_payment_method") {
          fail("Your payment method was declined. Please try a different card.");
        } else {
          fail(`Authentication failed. Status: ${paymentIntent.status || "unknown"}`);
        }
      }

      function failWithThrownError(err: unknown) {
        fail(err instanceof Error ? err.message : "Authentication failed due to an unexpected error");
      }

      stripe
        .confirmPayment({
          clientSecret,
          confirmParams: {
            payment_method: paymentMethodId,
            return_url: window.location.href
          },
          redirect: "if_required"
        })
        .then(routeResult)
        .catch(failWithThrownError);
    },
    [stripe, elements, clientSecret, paymentMethodId]
  );

  if (status === "succeeded") {
    return (
      <div className="py-8 text-center">
        <div className="mb-4 flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h3 className="mb-2 text-lg">Authentication Successful!</h3>
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
        <h3 className="mb-2 text-lg">Authentication Failed</h3>
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
          <h3 className="mb-2 text-lg">Secure Authentication</h3>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">Please complete the authentication process to continue.</p>
        </div>
      )}
      <div className="mb-4 flex justify-center">
        <Spinner className="h-16 w-16 text-primary" />
      </div>
      <h3 className="mb-2 text-lg">Processing Authentication</h3>
      <p className="text-muted-foreground">Please wait while we verify your card with your bank...</p>
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
  hideTitle = false,
  dependencies: d = DEPENDENCIES
}) => {
  const { stripeService } = d.useServices();
  const { resolvedTheme } = d.useTheme();
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
    <d.Elements
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
        dependencies={d}
      />
    </d.Elements>
  );
};
