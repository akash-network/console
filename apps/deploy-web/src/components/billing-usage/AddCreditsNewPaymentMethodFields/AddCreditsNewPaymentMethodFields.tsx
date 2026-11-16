"use client";

import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Alert, AlertDescription, Spinner } from "@akashnetwork/ui/components";
import { AddressElement, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeError } from "@stripe/stripe-js";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import type { IncompleteBillingDetail } from "./incompleteBillingDetail";
import { findIncompleteBillingDetail } from "./incompleteBillingDetail";
import type { IncompletePaymentMethodDetail } from "./incompletePaymentMethodDetail";
import { findIncompletePaymentMethodDetail } from "./incompletePaymentMethodDetail";

/** Why a payment method could not be set up, as codes only: Stripe's message is left out because it can echo what the user typed. */
export interface PaymentMethodSetupFailure {
  errorType?: string;
  errorCode?: string;
  declineCode?: string;
  incompleteBillingDetail?: IncompleteBillingDetail;
  incompletePaymentMethodDetail?: IncompletePaymentMethodDetail;
}

export type PaymentMethodSetupResult = { paymentMethodId: string } | { failure: PaymentMethodSetupFailure };

export type PaymentFormLoadError = "script_blocked" | "stripe_unavailable" | "load_error";

/**
 * Imperative contract exposed by a payment-method source so an orchestrator
 * (e.g. AddCreditsForm) can trigger payment-method creation without lifting
 * Stripe Elements context out of the child component.
 */
export interface PaymentMethodSourceHandle {
  /**
   * Confirms the Stripe SetupIntent and returns the new payment method id,
   * or why confirmation failed, in which case the source has already
   * surfaced the error inline.
   */
  addPaymentMethod(): Promise<PaymentMethodSetupResult>;
}

export function toPaymentMethodSetupFailure(error: StripeError): PaymentMethodSetupFailure {
  return {
    errorType: error.type,
    errorCode: error.code,
    declineCode: error.decline_code,
    incompleteBillingDetail: findIncompleteBillingDetail(error),
    incompletePaymentMethodDetail: findIncompletePaymentMethodDetail(error)
  };
}

type IncompleteDetail = { element: "address"; detail: IncompleteBillingDetail } | { element: "payment"; detail: IncompletePaymentMethodDetail };

const INCOMPLETE_BILLING_DETAIL_MESSAGES: Record<IncompleteBillingDetail, string> = {
  address: "Your billing address is incomplete. Fill in the highlighted fields under Billing address, then try again.",
  name: "Your billing name is incomplete. Enter your full name under Billing address, then try again."
};

const INCOMPLETE_PAYMENT_METHOD_DETAIL_MESSAGES: Record<IncompletePaymentMethodDetail, string> = {
  link_email: "Your email for Link is incomplete. Enter it under Choose a payment method to continue with Link, then try again.",
  link_phone: "Your phone number for Link is incomplete. Enter it under Choose a payment method to finish setting up Link, then try again.",
  link_verification: "Finish signing in to Link. Enter the verification code Link sent you under Choose a payment method, then try again.",
  link_saved_payment_method: "Choose which of your Link payment methods to pay with under Choose a payment method, then try again.",
  payment_details: "Your payment details are incomplete. Finish your card or Link details under Choose a payment method, then try again."
};

const SCROLL_TO_SECTION_START: ScrollIntoViewOptions = { behavior: "smooth", block: "start" };

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
  disabled?: boolean;
  /** Reports the payment-method type (card, bank, …) the user selects in the Stripe payment element, for analytics. */
  onPaymentTypeChange?: (type: string) => void;
  onReady?: () => void;
  onLoadFailed: (error: PaymentFormLoadError) => void;
  dependencies?: typeof DEPENDENCIES;
}

export const AddCreditsNewPaymentMethodFields = forwardRef<PaymentMethodSourceHandle, AddCreditsNewPaymentMethodFieldsProps>(
  function AddCreditsNewPaymentMethodFields(
    { clientSecret, isLoading, disabled, onPaymentTypeChange, onReady, onLoadFailed, dependencies: d = DEPENDENCIES },
    ref
  ) {
    const { stripeService } = d.useServices();
    const { resolvedTheme } = d.useTheme();

    const stripeLoad = useMemo(() => stripeService.load(), [stripeService]);
    const stripePromise = useMemo(() => stripeLoad.then(result => result.stripe), [stripeLoad]);
    const isDarkMode = useMemo(() => resolvedTheme === "dark", [resolvedTheme]);
    const stripeAppearance = useMemo(() => buildStripeAppearance(isDarkMode), [isDarkMode]);

    useEffect(
      function reportUnavailableStripe() {
        let isCurrentLoad = true;
        void stripeLoad.then(({ failure }) => {
          if (isCurrentLoad && failure) onLoadFailed(failure === "script_failed" ? "script_blocked" : "stripe_unavailable");
        });
        return () => {
          isCurrentLoad = false;
        };
      },
      [stripeLoad, onLoadFailed]
    );

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
        <d.Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
          <div
            ref={element => {
              if (element) element.inert = !!disabled;
            }}
          >
            <StripePaymentMethodFields
              ref={ref}
              dependencies={d}
              disabled={disabled}
              onPaymentTypeChange={onPaymentTypeChange}
              onReady={onReady}
              onLoadError={() => onLoadFailed("load_error")}
            />
          </div>
        </d.Elements>
      </ErrorBoundary>
    );
  }
);

interface StripePaymentMethodFieldsProps {
  dependencies: typeof DEPENDENCIES;
  disabled?: boolean;
  onPaymentTypeChange?: (type: string) => void;
  onReady?: () => void;
  onLoadError: () => void;
}

const StripePaymentMethodFields = forwardRef<PaymentMethodSourceHandle, StripePaymentMethodFieldsProps>(function StripePaymentMethodFields(
  { dependencies: d, disabled, onPaymentTypeChange, onReady, onLoadError },
  ref
) {
  const stripe = d.useStripe();
  const elements = d.useElements();
  const [error, setError] = useState<string | null>(null);
  const [incompleteDetail, setIncompleteDetail] = useState<IncompleteDetail | null>(null);
  /** Set by a refusal and consumed once the fields are interactive again, since an inert subtree cannot take focus. */
  const incompleteDetailToRevealRef = useRef<IncompleteDetail | null>(null);
  const lastPaymentTypeRef = useRef<string | null>(null);
  const billingSectionRef = useRef<HTMLElement>(null);
  const paymentSectionRef = useRef<HTMLElement>(null);
  const billingHeadingId = useId();
  const paymentHeadingId = useId();
  const shownError = incompleteDetail ? describeIncompleteDetail(incompleteDetail) : error;

  const clearError = useCallback(() => {
    setError(null);
    setIncompleteDetail(null);
  }, []);

  const clearIncompleteDetailOf = (element: IncompleteDetail["element"]) => {
    setIncompleteDetail(current => (current?.element === element ? null : current));
  };

  useEffect(
    function revealIncompleteFields() {
      const incompleteDetailToReveal = incompleteDetailToRevealRef.current;
      if (disabled || !incompleteDetailToReveal) return;
      incompleteDetailToRevealRef.current = null;
      if (incompleteDetailToReveal.element === "address") {
        elements?.getElement("address")?.focus();
        billingSectionRef.current?.scrollIntoView(SCROLL_TO_SECTION_START);
      } else {
        elements?.getElement("payment")?.focus();
        paymentSectionRef.current?.scrollIntoView(SCROLL_TO_SECTION_START);
      }
    },
    [disabled, incompleteDetail, elements]
  );

  const reportPaymentType = (type: string) => {
    if (type !== lastPaymentTypeRef.current) clearError();
    lastPaymentTypeRef.current = type;
    onPaymentTypeChange?.(type);
  };

  useImperativeHandle(
    ref,
    () => ({
      /**
       * Confirms the SetupIntent with Stripe and returns the resulting payment
       * method id. On failure the error is rendered inline and its codes are
       * returned so the orchestrator can short-circuit and report them.
       */
      async addPaymentMethod() {
        if (!stripe || !elements) {
          setError("The payment form is still loading. Please try again in a moment.");
          return { failure: { errorType: "form_not_ready" } };
        }

        clearError();
        let setupResult;
        try {
          setupResult = await stripe.confirmSetup({ elements, redirect: "if_required" });
        } catch {
          setError("Couldn't save your payment method. Please check your connection and try again.");
          return { failure: { errorType: "setup_request_failed" } };
        }

        if (setupResult.error) {
          const failure = toPaymentMethodSetupFailure(setupResult.error);
          const failureIncompleteDetail = findIncompleteDetail(failure);
          if (failureIncompleteDetail) {
            incompleteDetailToRevealRef.current = failureIncompleteDetail;
            setIncompleteDetail(failureIncompleteDetail);
          } else {
            setError(setupResult.error.message || "Couldn't save your card. Please try again.");
          }
          return { failure };
        }

        const paymentMethodId = setupResult.setupIntent?.payment_method;
        if (typeof paymentMethodId !== "string") {
          setError("Couldn't save your card. Please try again.");
          return { failure: { errorType: "missing_payment_method" } };
        }

        return { paymentMethodId };
      }
    }),
    [stripe, elements, clearError]
  );

  return (
    <div className="space-y-6">
      <section ref={billingSectionRef} aria-labelledby={billingHeadingId} className="scroll-mt-4 space-y-4">
        <h3 id={billingHeadingId} className="text-left text-sm font-medium text-muted-foreground">
          BILLING ADDRESS
        </h3>
        <d.AddressElement
          options={{ mode: "billing" }}
          onChange={event => {
            if (event.complete) clearIncompleteDetailOf("address");
          }}
        />
      </section>

      <section ref={paymentSectionRef} aria-labelledby={paymentHeadingId} className="scroll-mt-4 space-y-2">
        <h3 id={paymentHeadingId} className="text-left text-sm font-medium text-muted-foreground">
          CHOOSE A PAYMENT METHOD
        </h3>
        <d.PaymentElement
          options={{ layout: "tabs", paymentMethodOrder: ["card", "link"] }}
          onChange={event => {
            reportPaymentType(event.value.type);
            if (event.complete) clearIncompleteDetailOf("payment");
          }}
          onReady={onReady}
          onLoadError={onLoadError}
        />
      </section>

      <Alert variant="default" className="bg-muted p-3">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground">
          Your payment is securely processed by Stripe. You will be charged when you purchase credits.
        </AlertDescription>
      </Alert>

      {shownError && (
        <Alert variant="destructive" aria-label="Payment error">
          <AlertDescription>{shownError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

function findIncompleteDetail(failure: PaymentMethodSetupFailure): IncompleteDetail | null {
  if (failure.incompleteBillingDetail) return { element: "address", detail: failure.incompleteBillingDetail };
  if (failure.incompletePaymentMethodDetail) return { element: "payment", detail: failure.incompletePaymentMethodDetail };
  return null;
}

function describeIncompleteDetail(incompleteDetail: IncompleteDetail): string {
  return incompleteDetail.element === "address"
    ? INCOMPLETE_BILLING_DETAIL_MESSAGES[incompleteDetail.detail]
    : INCOMPLETE_PAYMENT_METHOD_DETAIL_MESSAGES[incompleteDetail.detail];
}

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
