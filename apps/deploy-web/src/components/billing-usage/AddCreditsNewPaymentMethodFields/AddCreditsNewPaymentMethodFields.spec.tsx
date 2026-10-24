import React from "react";
import type { Stripe } from "@stripe/stripe-js";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, PaymentMethodSourceHandle } from "./AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "./AddCreditsNewPaymentMethodFields";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(AddCreditsNewPaymentMethodFields.name, () => {
  it("shows a loading spinner when isLoading is true", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("status", { name: /preparing payment form/i })).toBeInTheDocument();
    expect(screen.queryByTestId("stripe-elements")).not.toBeInTheDocument();
  });

  it("renders nothing when no client secret is provided", () => {
    const Elements = vi.fn(() => <div data-testid="stripe-elements" />) as unknown as typeof DEPENDENCIES.Elements;
    setup({ isLoading: false, dependencies: { Elements } });

    expect(screen.queryByRole("status", { name: /preparing payment form/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("stripe-elements")).not.toBeInTheDocument();
  });

  it("renders the Stripe Elements wrapper with billing fields when the client secret is ready", () => {
    setup({ isLoading: false, clientSecret: "seti_secret" });

    expect(screen.getByTestId("stripe-elements")).toBeInTheDocument();
    expect(screen.getByTestId("address-element")).toBeInTheDocument();
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  it("reports Stripe as unavailable when it loads as nothing, even before the client secret is ready", async () => {
    const { onLoadFailed } = setup({ isLoading: true, stripe: null });

    await waitFor(() => expect(onLoadFailed).toHaveBeenCalledWith("stripe_unavailable"));
    expect(onLoadFailed).toHaveBeenCalledTimes(1);
  });

  it("does not report a failure when Stripe loads", async () => {
    const { onLoadFailed, stripeLoaded } = setup({ isLoading: false, clientSecret: "seti_secret" });

    await act(() => stripeLoaded);

    expect(onLoadFailed).not.toHaveBeenCalled();
  });

  it("does not report Stripe as unavailable once the fields are gone", async () => {
    const stripeLoad = Promise.withResolvers<null>();
    const { onLoadFailed, unmount } = setup({ isLoading: false, clientSecret: "seti_secret", stripe: stripeLoad.promise });

    unmount();
    await act(async () => stripeLoad.resolve(null));

    expect(onLoadFailed).not.toHaveBeenCalled();
  });

  it("reports when the payment element fails to load", () => {
    const PaymentElement = ((props: { onLoadError?: () => void }) => (
      <button type="button" onClick={() => props.onLoadError?.()}>
        fail to load
      </button>
    )) as unknown as typeof DEPENDENCIES.PaymentElement;
    const { onLoadFailed } = setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { PaymentElement } });

    fireEvent.click(screen.getByRole("button", { name: /fail to load/i }));

    expect(onLoadFailed).toHaveBeenCalledWith("load_error");
  });

  it("addPaymentMethod returns the Stripe payment method id", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: "pm_123" } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(confirmSetup).toHaveBeenCalledWith({ elements: expect.anything(), redirect: "if_required" });
    expect(result).toEqual({ paymentMethodId: "pm_123" });
  });

  it("confirms with Stripe once it finishes loading after the first render", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: "pm_late" } });
    let loadedStripe: ReturnType<typeof DEPENDENCIES.useStripe> = null;
    const { ref, rerender } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => loadedStripe }
    });

    loadedStripe = { confirmSetup } as unknown as ReturnType<typeof DEPENDENCIES.useStripe>;
    rerender();
    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toEqual({ paymentMethodId: "pm_late" });
  });

  it("renders the confirmSetup error inline and returns its codes without the message", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({
      error: { type: "card_error", code: "card_declined", decline_code: "generic_decline", message: "Your card was declined." }
    });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toEqual({ failure: { errorType: "card_error", errorCode: "card_declined", declineCode: "generic_decline" } });
    expect(await screen.findByText("Your card was declined.")).toBeInTheDocument();
  });

  it("returns the code of a failed 3D Secure challenge during setup", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ error: { type: "invalid_request_error", code: "setup_intent_authentication_failure" } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toEqual({ failure: { errorType: "invalid_request_error", errorCode: "setup_intent_authentication_failure" } });
    expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent("Couldn't save your card. Please try again.");
  });

  it("reports a missing payment method and shows a generic error when no payment method id comes back", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: null } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toEqual({ failure: { errorType: "missing_payment_method" } });
    expect(await screen.findByText(/couldn't save your card/i)).toBeInTheDocument();
  });

  it("keeps the fields mounted and releases a rejected Stripe confirmation for retry", async () => {
    const confirmSetup = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValue({ setupIntent: { payment_method: "pm_retry" } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => mock<NonNullable<ReturnType<typeof DEPENDENCIES.useStripe>>>({ confirmSetup }) }
    });
    const fields = screen.getByTestId("payment-element");

    expect(await act(async () => ref.current!.addPaymentMethod())).toEqual({ failure: { errorType: "setup_request_failed" } });
    expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent(/couldn't save your payment method/i);
    expect(screen.getByTestId("payment-element")).toBe(fields);
    expect(await act(async () => ref.current!.addPaymentMethod())).toEqual({ paymentMethodId: "pm_retry" });
    expect(screen.queryByRole("alert", { name: /payment error/i })).not.toBeInTheDocument();
  });

  it("reports the selected payment method type from the payment element", () => {
    const onPaymentTypeChange = vi.fn();
    const PaymentElement = ((props: { onChange?: (event: { value: { type: string } }) => void }) => (
      <button type="button" onClick={() => props.onChange?.({ value: { type: "us_bank_account" } })}>
        choose bank
      </button>
    )) as unknown as typeof DEPENDENCIES.PaymentElement;

    setup({ isLoading: false, clientSecret: "seti_secret", onPaymentTypeChange, dependencies: { PaymentElement } });

    fireEvent.click(screen.getByRole("button", { name: /choose bank/i }));

    expect(onPaymentTypeChange).toHaveBeenCalledWith("us_bank_account");
  });

  it("ignores a payment method change when nobody listens for it", () => {
    const PaymentElement = ((props: { onChange?: (event: { value: { type: string } }) => void }) => (
      <button type="button" onClick={() => props.onChange?.({ value: { type: "card" } })}>
        choose card
      </button>
    )) as unknown as typeof DEPENDENCIES.PaymentElement;

    setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { PaymentElement } });

    expect(() => fireEvent.click(screen.getByRole("button", { name: /choose card/i }))).not.toThrow();
  });

  it("reports when the payment element has loaded", () => {
    const onReady = vi.fn();
    const PaymentElement = vi.fn<typeof DEPENDENCIES.PaymentElement>(() => null);
    setup({ isLoading: false, clientSecret: "seti_secret", onReady, dependencies: { PaymentElement } });

    expect(PaymentElement).toHaveBeenCalledWith(expect.objectContaining({ onReady }), expect.anything());
  });

  it("keeps the Stripe fields mounted while disabling and re-enabling interaction", () => {
    const { rerender } = setup({ isLoading: false, clientSecret: "seti_secret" });
    const elements = screen.getByTestId("stripe-elements");
    const fields = elements.firstElementChild;

    expect(fields).toHaveProperty("inert", false);
    rerender(true);
    expect(elements.firstElementChild).toBe(fields);
    expect(fields).toHaveProperty("inert", true);
    rerender(false);
    expect(elements.firstElementChild).toBe(fields);
    expect(fields).toHaveProperty("inert", false);
  });

  it("opens the tabbed payment element on card entry, with Link after it", () => {
    const PaymentElement = vi.fn<typeof DEPENDENCIES.PaymentElement>(() => null);
    setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { PaymentElement } });

    expect(PaymentElement).toHaveBeenCalledWith(
      expect.objectContaining({ options: { layout: "tabs", paymentMethodOrder: ["card", "link"] } }),
      expect.anything()
    );
  });

  it("shows a retryable inline error while Stripe is still loading", async () => {
    const { ref } = setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { useStripe: () => null } });

    expect(await act(async () => ref.current!.addPaymentMethod())).toEqual({ failure: { errorType: "form_not_ready" } });

    expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent("The payment form is still loading. Please try again in a moment.");
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  function setup(input: {
    isLoading: boolean;
    clientSecret?: string;
    stripe?: Stripe | null | Promise<Stripe | null>;
    onPaymentTypeChange?: (type: string) => void;
    onReady?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const Elements = (({ children }: { children?: React.ReactNode }) => (
      <div data-testid="stripe-elements">{children}</div>
    )) as unknown as typeof DEPENDENCIES.Elements;

    const stripeLoaded = Promise.resolve(input.stripe === undefined ? mock<Stripe>() : input.stripe);
    const stripeService = mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({ getStripe: () => stripeLoaded });
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ stripeService });
    const onLoadFailed = vi.fn();

    const useTheme: typeof DEPENDENCIES.useTheme = () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: "light" });

    const useStripe: typeof DEPENDENCIES.useStripe = () => mock<ReturnType<typeof DEPENDENCIES.useStripe>>();
    const useElements: typeof DEPENDENCIES.useElements = () => mock<ReturnType<typeof DEPENDENCIES.useElements>>();

    const ref = React.createRef<PaymentMethodSourceHandle>();

    const renderFields = (disabled = false) => (
      <AddCreditsNewPaymentMethodFields
        ref={ref}
        clientSecret={input.clientSecret}
        isLoading={input.isLoading}
        disabled={disabled}
        onPaymentTypeChange={input.onPaymentTypeChange}
        onReady={input.onReady}
        onLoadFailed={onLoadFailed}
        dependencies={{
          Elements,
          useServices,
          useTheme,
          useStripe,
          useElements,
          AddressElement: (() => <div data-testid="address-element" />) as unknown as typeof DEPENDENCIES.AddressElement,
          PaymentElement: (() => <div data-testid="payment-element" />) as unknown as typeof DEPENDENCIES.PaymentElement,
          ...input.dependencies
        }}
      />
    );
    const view = render(renderFields());

    return { ref, onLoadFailed, stripeLoaded, unmount: view.unmount, rerender: (disabled = false) => view.rerender(renderFields(disabled)) };
  }
});
