import React from "react";
import type { Stripe, StripeAddressElement } from "@stripe/stripe-js";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeLoadResult } from "@src/services/stripe/stripe.service";
import type { DEPENDENCIES, PaymentMethodSourceHandle } from "./AddCreditsNewPaymentMethodFields";
import { AddCreditsNewPaymentMethodFields } from "./AddCreditsNewPaymentMethodFields";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const INCOMPLETE_ADDRESS = { error: { type: "validation_error", code: "incomplete_address", message: "Your address is incomplete." } };

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

  it("reports Stripe as unavailable when it is not configured, even before the client secret is ready", async () => {
    const { onLoadFailed } = setup({ isLoading: true, stripeLoad: { stripe: null, failure: "unconfigured" } });

    await waitFor(() => expect(onLoadFailed).toHaveBeenCalledWith("stripe_unavailable"));
    expect(onLoadFailed).toHaveBeenCalledTimes(1);
  });

  it("reports the Stripe script as blocked when the browser could not load it", async () => {
    const { onLoadFailed } = setup({ isLoading: true, stripeLoad: { stripe: null, failure: "script_failed" } });

    await waitFor(() => expect(onLoadFailed).toHaveBeenCalledWith("script_blocked"));
    expect(onLoadFailed).toHaveBeenCalledTimes(1);
  });

  it("hands the loaded Stripe instance to Elements", async () => {
    const stripe = mock<Stripe>();
    const Elements = vi.fn(({ children }: { children?: React.ReactNode }) => <div>{children}</div>) as unknown as typeof DEPENDENCIES.Elements;
    setup({ isLoading: false, clientSecret: "seti_secret", stripeLoad: { stripe }, dependencies: { Elements } });

    const stripeProp = vi.mocked(Elements).mock.calls[0][0].stripe;

    expect(await stripeProp).toBe(stripe);
  });

  it("does not report a failure when Stripe loads", async () => {
    const { onLoadFailed, stripeLoaded } = setup({ isLoading: false, clientSecret: "seti_secret" });

    await act(() => stripeLoaded);

    expect(onLoadFailed).not.toHaveBeenCalled();
  });

  it("does not report Stripe as unavailable once the fields are gone", async () => {
    const stripeLoad = Promise.withResolvers<StripeLoadResult>();
    const { onLoadFailed, unmount } = setup({ isLoading: false, clientSecret: "seti_secret", stripeLoad: stripeLoad.promise });

    unmount();
    await act(async () => stripeLoad.resolve({ stripe: null, failure: "script_failed" }));

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

  describe("when the billing details are incomplete", () => {
    it.each([
      ["address", "incomplete_address_line1", "Your billing address is incomplete. Fill in the highlighted fields under Billing address, then try again."],
      ["name", "incomplete_name", "Your billing name is incomplete. Enter your full name under Billing address, then try again."]
    ])("says the billing %s is incomplete and returns which detail it was", async (detail, code, message) => {
      const { ref } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        dependencies: { useStripe: stripeConfirmingSetupWith({ error: { type: "validation_error", code, message: "Your address is incomplete." } }) }
      });

      const result = await act(async () => ref.current!.addPaymentMethod());

      expect(result).toEqual({ failure: { errorType: "validation_error", errorCode: code, incompleteBillingDetail: detail } });
      expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent(message);
    });

    it("brings the billing address fields into view and focuses them", async () => {
      const addressElement = mock<StripeAddressElement>();
      const { ref, getElement } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        addressElement,
        dependencies: { useStripe: stripeConfirmingSetupWith(INCOMPLETE_ADDRESS) }
      });
      const billingSection = screen.getByRole("region", { name: /billing address/i });
      billingSection.scrollIntoView = vi.fn();

      await act(async () => ref.current!.addPaymentMethod());

      expect(getElement).toHaveBeenCalledWith("address");
      expect(addressElement.focus).toHaveBeenCalledOnce();
      expect(billingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    });

    it("waits until the fields are interactive again before focusing them, and focuses them only once", async () => {
      const addressElement = mock<StripeAddressElement>();
      const { ref, rerender } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        addressElement,
        dependencies: { useStripe: stripeConfirmingSetupWith(INCOMPLETE_ADDRESS) }
      });
      rerender(true);

      await act(async () => ref.current!.addPaymentMethod());
      expect(addressElement.focus).not.toHaveBeenCalled();

      rerender(false);
      expect(addressElement.focus).toHaveBeenCalledOnce();

      rerender(true);
      rerender(false);
      expect(addressElement.focus).toHaveBeenCalledOnce();
    });

    it("keeps Stripe's own message and leaves the billing fields alone for any other validation error", async () => {
      const addressElement = mock<StripeAddressElement>();
      const { ref } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        addressElement,
        dependencies: {
          useStripe: stripeConfirmingSetupWith({ error: { type: "validation_error", code: "incomplete_number", message: "Your card number is incomplete." } })
        }
      });

      const result = await act(async () => ref.current!.addPaymentMethod());

      expect(result).toEqual({ failure: { errorType: "validation_error", errorCode: "incomplete_number" } });
      expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent("Your card number is incomplete.");
      expect(addressElement.focus).not.toHaveBeenCalled();
    });

    it("clears the error once the billing address is complete, not while it is still being filled in", async () => {
      const AddressElement = ((props: { onChange?: (event: { complete: boolean }) => void }) => (
        <>
          <button type="button" onClick={() => props.onChange?.({ complete: false })}>
            type part of the address
          </button>
          <button type="button" onClick={() => props.onChange?.({ complete: true })}>
            complete the address
          </button>
        </>
      )) as unknown as typeof DEPENDENCIES.AddressElement;
      const { ref } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        dependencies: { AddressElement, useStripe: stripeConfirmingSetupWith(INCOMPLETE_ADDRESS) }
      });
      await act(async () => ref.current!.addPaymentMethod());

      fireEvent.click(screen.getByRole("button", { name: /type part of the address/i }));
      expect(screen.getByRole("alert", { name: /payment error/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /complete the address/i }));
      expect(screen.queryByRole("alert", { name: /payment error/i })).not.toBeInTheDocument();
    });

    it("lets the next submit through once the billing details are filled in", async () => {
      const confirmSetup = vi
        .fn()
        .mockResolvedValueOnce(INCOMPLETE_ADDRESS)
        .mockResolvedValue({ setupIntent: { payment_method: "pm_complete" } });
      const { ref } = setup({
        isLoading: false,
        clientSecret: "seti_secret",
        dependencies: { useStripe: () => mock<NonNullable<ReturnType<typeof DEPENDENCIES.useStripe>>>({ confirmSetup }) }
      });

      await act(async () => ref.current!.addPaymentMethod());
      const result = await act(async () => ref.current!.addPaymentMethod());

      expect(result).toEqual({ paymentMethodId: "pm_complete" });
      expect(screen.queryByRole("alert", { name: /payment error/i })).not.toBeInTheDocument();
    });
  });

  it.each([
    ["an incomplete billing address", INCOMPLETE_ADDRESS],
    ["a declined card", { error: { type: "card_error", code: "card_declined", message: "Your card was declined." } }]
  ])("clears the error about %s when the user switches payment method, but not while they keep using the same one", async (_, setupResult) => {
    const onPaymentTypeChange = vi.fn();
    const PaymentElement = ((props: { onChange?: (event: { value: { type: string } }) => void }) => (
      <>
        <button type="button" onClick={() => props.onChange?.({ value: { type: "card" } })}>
          edit card
        </button>
        <button type="button" onClick={() => props.onChange?.({ value: { type: "link" } })}>
          choose link
        </button>
      </>
    )) as unknown as typeof DEPENDENCIES.PaymentElement;
    const { ref } = setup({
      isLoading: false,
      clientSecret: "seti_secret",
      onPaymentTypeChange,
      dependencies: { PaymentElement, useStripe: stripeConfirmingSetupWith(setupResult) }
    });
    fireEvent.click(screen.getByRole("button", { name: /edit card/i }));
    await act(async () => ref.current!.addPaymentMethod());

    fireEvent.click(screen.getByRole("button", { name: /edit card/i }));
    expect(screen.getByRole("alert", { name: /payment error/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /choose link/i }));
    expect(screen.queryByRole("alert", { name: /payment error/i })).not.toBeInTheDocument();
    expect(onPaymentTypeChange).toHaveBeenLastCalledWith("link");
  });

  it("shows a retryable inline error while Stripe is still loading", async () => {
    const { ref } = setup({ isLoading: false, clientSecret: "seti_secret", dependencies: { useStripe: () => null } });

    expect(await act(async () => ref.current!.addPaymentMethod())).toEqual({ failure: { errorType: "form_not_ready" } });

    expect(screen.getByRole("alert", { name: /payment error/i })).toHaveTextContent("The payment form is still loading. Please try again in a moment.");
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });

  function stripeConfirmingSetupWith(setupResult: unknown): typeof DEPENDENCIES.useStripe {
    const confirmSetup = vi.fn().mockResolvedValue(setupResult);
    return () => mock<NonNullable<ReturnType<typeof DEPENDENCIES.useStripe>>>({ confirmSetup });
  }

  function setup(input: {
    isLoading: boolean;
    clientSecret?: string;
    addressElement?: StripeAddressElement;
    stripeLoad?: StripeLoadResult | Promise<StripeLoadResult>;
    onPaymentTypeChange?: (type: string) => void;
    onReady?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const Elements = (({ children }: { children?: React.ReactNode }) => (
      <div data-testid="stripe-elements">{children}</div>
    )) as unknown as typeof DEPENDENCIES.Elements;

    const stripeLoaded = Promise.resolve(input.stripeLoad ?? { stripe: mock<Stripe>() });
    const stripeService = mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({ load: () => stripeLoaded });
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ stripeService });
    const onLoadFailed = vi.fn();

    const useTheme: typeof DEPENDENCIES.useTheme = () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: "light" });

    const useStripe: typeof DEPENDENCIES.useStripe = () => mock<ReturnType<typeof DEPENDENCIES.useStripe>>();
    const getElement = vi.fn().mockReturnValue(input.addressElement ?? null);
    const elements = mock<NonNullable<ReturnType<typeof DEPENDENCIES.useElements>>>({ getElement });
    const useElements: typeof DEPENDENCIES.useElements = () => elements;

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

    return { ref, onLoadFailed, stripeLoaded, getElement, unmount: view.unmount, rerender: (disabled = false) => view.rerender(renderFields(disabled)) };
  }
});
