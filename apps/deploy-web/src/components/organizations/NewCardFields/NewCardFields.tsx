"use client";
import { forwardRef, useImperativeHandle, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptionsMode } from "@stripe/stripe-js";
import { useTheme } from "next-themes";

import { useServices } from "@src/context/ServicesProvider";

export const DEPENDENCIES = { Elements, PaymentElement, useStripe, useElements, useTheme };

export const CARD_SAVE_FAILED_REASON = "Something went wrong while saving it.";

/** Must stay the payment method types of the setup intents the API creates, or Stripe refuses to confirm them. */
const SETUP_INTENT_PAYMENT_METHOD_TYPES = ["card", "link"];

/** Collects a card before the SetupIntent that saves it exists. */
export interface NewCardHandle {
  validate(): Promise<boolean>;
  /** Resolves why the card wasn't saved, or nothing once it is. */
  save(clientSecret: string): Promise<string | undefined>;
}

type Props = {
  onCompleteChange: (isComplete: boolean) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const NewCardFields = forwardRef<NewCardHandle, Props>(function NewCardFields({ onCompleteChange, dependencies: d = DEPENDENCIES }, ref) {
  const { stripeService } = useServices();
  const { resolvedTheme } = d.useTheme();
  const [stripePromise] = useState(() => stripeService.getStripe());

  return (
    <d.Elements stripe={stripePromise} options={buildSetupOptions(resolvedTheme === "dark")}>
      <CardFields ref={ref} onCompleteChange={onCompleteChange} dependencies={d} />
    </d.Elements>
  );
});

const CardFields = forwardRef<NewCardHandle, Required<Props>>(function CardFields({ onCompleteChange, dependencies: d }, ref) {
  const stripe = d.useStripe();
  const elements = d.useElements();

  useImperativeHandle(ref, () => ({
    async validate() {
      if (!elements) return false;

      const { error } = await elements.submit();
      return !error;
    },
    async save(clientSecret: string) {
      if (!stripe || !elements) return CARD_SAVE_FAILED_REASON;

      const { error } = await stripe.confirmSetup({ elements, clientSecret, redirect: "if_required" });
      return error ? error.message || CARD_SAVE_FAILED_REASON : undefined;
    }
  }));

  return <d.PaymentElement onChange={event => onCompleteChange(event.complete)} />;
});

function buildSetupOptions(isDarkMode: boolean): StripeElementsOptionsMode {
  return {
    mode: "setup",
    currency: "usd",
    paymentMethodTypes: SETUP_INTENT_PAYMENT_METHOD_TYPES,
    appearance: {
      theme: isDarkMode ? "night" : "stripe",
      variables: { colorPrimary: isDarkMode ? "#e3e3e3" : "#171717", colorSuccess: "#16a34a" }
    }
  };
}
