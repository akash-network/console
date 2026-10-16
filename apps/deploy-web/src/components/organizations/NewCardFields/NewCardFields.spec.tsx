import { createRef } from "react";
import type { Stripe, StripeElements, StripePaymentElementChangeEvent } from "@stripe/stripe-js";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/services/stripe/stripe.service";
import type { DEPENDENCIES, NewCardHandle } from "./NewCardFields";
import { CARD_SAVE_FAILED_REASON, NewCardFields } from "./NewCardFields";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(NewCardFields.name, () => {
  it("prepares Stripe to collect a card or Link before any setup intent exists", () => {
    const { Elements, stripePromise } = setup({});

    expect(Elements).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe: stripePromise,
        options: {
          mode: "setup",
          currency: "usd",
          paymentMethodTypes: ["card", "link"],
          appearance: { theme: "stripe", variables: { colorPrimary: "#171717", colorSuccess: "#16a34a" } }
        }
      }),
      expect.anything()
    );
  });

  it("matches the dark theme", () => {
    const { Elements } = setup({ theme: "dark" });

    expect(Elements).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ appearance: { theme: "night", variables: { colorPrimary: "#e3e3e3", colorSuccess: "#16a34a" } } })
      }),
      expect.anything()
    );
  });

  it("tells whether the card is filled in", async () => {
    const { onCompleteChange } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Fill in the card" }));

    expect(onCompleteChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("accepts the card when Stripe validates its fields", async () => {
    const { ref, elements } = setup({});
    elements.submit.mockResolvedValue({ error: undefined });

    expect(await act(() => ref.current!.validate())).toBe(true);
  });

  it("refuses the card when Stripe finds a problem in its fields", async () => {
    const { ref, elements } = setup({});
    elements.submit.mockResolvedValue({ error: { type: "validation_error", message: "Your card number is incomplete." } });

    expect(await act(() => ref.current!.validate())).toBe(false);
  });

  it("refuses the card while Stripe is still loading", async () => {
    const { ref } = setup({ isStripeLoaded: false });

    expect(await act(() => ref.current!.validate())).toBe(false);
  });

  it("saves the card on the given setup intent, authenticating it in place when the bank asks", async () => {
    const { ref, stripe, elements } = setup({});
    stripe.confirmSetup.mockResolvedValue(mock<Awaited<ReturnType<Stripe["confirmSetup"]>>>({ error: undefined }));

    const failure = await act(() => ref.current!.save("seti_secret"));

    expect(failure).toBeUndefined();
    expect(stripe.confirmSetup).toHaveBeenCalledExactlyOnceWith({ elements, clientSecret: "seti_secret", redirect: "if_required" });
  });

  it("explains why Stripe didn't save the card", async () => {
    const { ref, stripe } = setup({});
    stripe.confirmSetup.mockResolvedValue({ error: { type: "card_error", message: "Your card was declined." } });

    expect(await act(() => ref.current!.save("seti_secret"))).toBe("Your card was declined.");
  });

  it("says the card wasn't saved when Stripe gives no reason", async () => {
    const { ref, stripe } = setup({});
    stripe.confirmSetup.mockResolvedValue({ error: { type: "api_error" } });

    expect(await act(() => ref.current!.save("seti_secret"))).toBe(CARD_SAVE_FAILED_REASON);
  });

  it("says the card wasn't saved while Stripe is still loading", async () => {
    const { ref } = setup({ isStripeLoaded: false });

    expect(await act(() => ref.current!.save("seti_secret"))).toBe(CARD_SAVE_FAILED_REASON);
  });

  function setup(input: { theme?: string; isStripeLoaded?: boolean }) {
    const stripe = mock<Stripe>();
    const elements = mock<StripeElements>();
    const stripePromise = Promise.resolve(stripe);
    const stripeService = mock<StripeService>({ getStripe: () => stripePromise });
    const onCompleteChange = vi.fn();
    const ref = createRef<NewCardHandle>();
    const isStripeLoaded = input.isStripeLoaded ?? true;
    const Elements = vi.fn<typeof DEPENDENCIES.Elements>(({ children }) => <>{children}</>);
    const dependencies: typeof DEPENDENCIES = {
      Elements,
      PaymentElement: ({ onChange }) => (
        <button type="button" onClick={() => onChange?.(mock<StripePaymentElementChangeEvent>({ complete: true }))}>
          Fill in the card
        </button>
      ),
      useStripe: () => (isStripeLoaded ? stripe : null),
      useElements: () => (isStripeLoaded ? elements : null),
      useTheme: () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: input.theme ?? "light" })
    };

    render(
      <TestContainerProvider services={{ stripeService: () => stripeService }}>
        <NewCardFields ref={ref} onCompleteChange={onCompleteChange} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { ref, stripe, elements, stripePromise, Elements, onCompleteChange };
  }
});
