"use client";

import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Alert, AlertDescription, Field, FieldLabel, Input, Spinner } from "@akashnetwork/ui/components";
import { AddressElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";

/**
 * Imperative contract exposed by a payment-method source so an orchestrator
 * (e.g. AddCreditsForm) can trigger payment-method creation without lifting
 * Stripe Elements context out of the child component.
 */
export interface PaymentMethodSourceHandle {
  /**
   * Confirms the Stripe SetupIntent and returns the new payment method id
   * (with optional organization label), or null if confirmation failed —
   * in which case the source has already surfaced the error inline.
   */
  addPaymentMethod(): Promise<{ paymentMethodId: string; organization?: string } | null>;
}

export const DEPENDENCIES = {
  Elements,
  useServices,
  useTheme,
  useStripe,
  useElements,
  AddressElement,
  PaymentElement
};

interface AddCreditsNewPaymentMethodFieldsProps {
  clientSecret?: string;
  isLoading: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const AddCreditsNewPaymentMethodFields = forwardRef<PaymentMethodSourceHandle, AddCreditsNewPaymentMethodFieldsProps>(
  function AddCreditsNewPaymentMethodFields({ clientSecret, isLoading, dependencies: d = DEPENDENCIES }, ref) {
    const { stripeService } = d.useServices();
    const { resolvedTheme } = d.useTheme();

    const stripePromise = useMemo(() => stripeService.getStripe(), [stripeService]);
    const isDarkMode = useMemo(() => resolvedTheme === "dark", [resolvedTheme]);
    const stripeAppearance = useMemo(() => buildStripeAppearance(isDarkMode), [isDarkMode]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Preparing payment form">
          <Spinner size="large" />
        </div>
      );
    }

    if (!clientSecret) {
      return null;
    }

    return (
      <ErrorBoundary fallback={<div>Failed to load payment form</div>}>
        {stripePromise ? (
          <d.Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
            <StripePaymentMethodFields ref={ref} dependencies={d} />
          </d.Elements>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            Payment processing is not available at this time. Please try again later or contact support if the issue persists.
          </div>
        )}
      </ErrorBoundary>
    );
  }
);

interface StripePaymentMethodFieldsProps {
  dependencies: typeof DEPENDENCIES;
}

const StripePaymentMethodFields = forwardRef<PaymentMethodSourceHandle, StripePaymentMethodFieldsProps>(function StripePaymentMethodFields(
  { dependencies: d },
  ref
) {
  const stripe = d.useStripe();
  const elements = d.useElements();
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      /**
       * Confirms the SetupIntent with Stripe and returns the resulting payment
       * method id plus the typed organization. On failure the error is rendered
       * inline and null is returned so the orchestrator can short-circuit.
       */
      async addPaymentMethod() {
        if (!stripe || !elements) {
          return null;
        }

        setError(null);
        const setupResult = await stripe.confirmSetup({ elements, redirect: "if_required" });

        if (setupResult.error) {
          setError(setupResult.error.message || "Couldn't save your card. Please try again.");
          return null;
        }

        const paymentMethodId = setupResult.setupIntent?.payment_method;
        if (typeof paymentMethodId !== "string") {
          setError("Couldn't save your card. Please try again.");
          return null;
        }

        return { paymentMethodId, organization: organization || undefined };
      }
    }),
    [stripe, elements, organization]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-left text-sm font-medium text-muted-foreground">BILLING ADDRESS</h3>
        <d.AddressElement options={{ mode: "billing" }} />
      </div>

      <div className="space-y-2">
        <h3 className="text-left text-sm font-medium text-muted-foreground">CHOOSE A PAYMENT METHOD</h3>
        <d.PaymentElement options={{ layout: "tabs" }} />
      </div>

      <Field className="gap-1">
        <FieldLabel htmlFor="organization" className="font-medium">
          Organization (optional)
        </FieldLabel>
        <Input
          id="organization"
          aria-label="organization"
          inputClassName="h-9"
          value={organization}
          onChange={e => setOrganization(e.target.value)}
          className="shadow-sm"
        />
      </Field>

      <Alert variant="default" className="bg-muted p-3">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground">
          Akash (operated by Overclock Labs) only charges your card if you choose to purchase credits after your trial.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

/**
 * Builds the Stripe Elements appearance config so it stays out of the JSX and
 * recomputes only when the resolved theme flips between light and dark.
 */
function buildStripeAppearance(isDarkMode: boolean) {
  return {
    theme: (isDarkMode ? "night" : "stripe") as "night" | "stripe",
    variables: {
      colorPrimary: isDarkMode ? "#fff" : "#000",
      colorSuccess: "#16a34a",
      borderRadius: "8px",
      fontWeightNormal: "500",
      colorBackground: isDarkMode ? "#262626" : "#fff"
    },
    rules: {
      ".Input": { padding: "8px", boxShadow: "none" },
      ".Tab": { boxShadow: "none" },
      ".PickerItem": { boxShadow: "none" },
      ...(isDarkMode && {
        ".Tab--selected": { border: "1px solid #fff", backgroundColor: "#262626" },
        ".TabIcon--selected": { fill: "#fff" },
        ".TabLabel--selected": { color: "#fff" }
      })
    }
  };
}
