import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, PaymentMethodSourceHandle } from "./AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "./AddCreditsNewPaymentMethodFields";

import { act, fireEvent, render, screen } from "@testing-library/react";

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

  it("shows the unavailable message when Stripe cannot be loaded", () => {
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        stripeService: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({
          getStripe: () => null as unknown as ReturnType<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]["getStripe"]>
        })
      });
    setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { useServices } });

    expect(screen.getByText(/Payment processing is not available at this time/i)).toBeInTheDocument();
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

  it("renders the confirmSetup error inline and returns null", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ error: { message: "Your card was declined." } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toBeNull();
    expect(await screen.findByText("Your card was declined.")).toBeInTheDocument();
  });

  it("returns null and shows a generic error when no payment method id comes back", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: null } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toBeNull();
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

    expect(await act(async () => ref.current!.addPaymentMethod())).toBeNull();
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

  it("offers Link before card entry in the tabbed payment element", () => {
    const PaymentElement = vi.fn<typeof DEPENDENCIES.PaymentElement>(() => null);
    setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { PaymentElement } });

    expect(PaymentElement).toHaveBeenCalledWith(
      expect.objectContaining({ options: { layout: "tabs", paymentMethodOrder: ["link", "card"] } }),
      expect.anything()
    );
  });

  it("shows a retryable inline error while Stripe is still loading", async () => {
    const { ref } = setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { useStripe: () => null } });

    expect(await act(async () => ref.current!.addPaymentMethod())).toBeNull();

    expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent("The payment form is still loading. Please try again in a moment.");
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  function setup(input: {
    isLoading: boolean;
    clientSecret?: string;
    onPaymentTypeChange?: (type: string) => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const Elements = (({ children }: { children?: React.ReactNode }) => (
      <div data-testid="stripe-elements">{children}</div>
    )) as unknown as typeof DEPENDENCIES.Elements;

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        stripeService: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({
          getStripe: () => Promise.resolve(mock<Awaited<ReturnType<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]["getStripe"]>>>())
        })
      });

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

    return { ref, rerender: (disabled = false) => view.rerender(renderFields(disabled)) };
  }
});
