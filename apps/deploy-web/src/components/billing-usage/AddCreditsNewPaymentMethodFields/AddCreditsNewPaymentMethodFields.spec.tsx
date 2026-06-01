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
    expect(screen.getByLabelText("organization")).toBeInTheDocument();
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

  it("addPaymentMethod returns the Stripe payment method id and the typed organization", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: "pm_123" } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    fireEvent.change(screen.getByLabelText("organization"), { target: { value: "Acme" } });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(confirmSetup).toHaveBeenCalledWith({ elements: expect.anything(), redirect: "if_required" });
    expect(result).toEqual({ paymentMethodId: "pm_123", organization: "Acme" });
  });

  it("omits organization when the field is left blank", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { payment_method: "pm_blank" } });
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      dependencies: { useStripe: () => ({ confirmSetup }) as unknown as ReturnType<typeof DEPENDENCIES.useStripe> }
    });

    const result = await act(async () => ref.current!.addPaymentMethod());

    expect(result).toEqual({ paymentMethodId: "pm_blank", organization: undefined });
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

  function setup(input: { isLoading: boolean; clientSecret?: string; dependencies?: Partial<typeof DEPENDENCIES> }) {
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

    render(
      <AddCreditsNewPaymentMethodFields
        ref={ref}
        clientSecret={input.clientSecret}
        isLoading={input.isLoading}
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

    return { ref };
  }
});
