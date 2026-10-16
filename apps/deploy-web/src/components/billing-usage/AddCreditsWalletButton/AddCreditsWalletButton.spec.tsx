import React from "react";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent, Stripe } from "@stripe/stripe-js";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { AddCreditsWalletButton, type DEPENDENCIES } from "./AddCreditsWalletButton";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(AddCreditsWalletButton.name, () => {
  it("shows an available wallet before collecting card details and uses the current amount", async () => {
    const { paymentRequest, onOpenChange, stripe, PaymentRequestButtonElement } = setup({ amount: 100 });

    fireEvent.click(await screen.findByRole("button", { name: "Pay with wallet" }));

    expect(paymentRequest.update).toHaveBeenCalledWith({ total: { label: "Akash credits", amount: 10000 } });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(stripe.paymentRequest).toHaveBeenCalledWith({
      country: "US",
      currency: "usd",
      total: { label: "Akash credits", amount: 0 },
      requestPayerName: true,
      requestPayerEmail: true
    });
    expect(PaymentRequestButtonElement).toHaveBeenCalledWith(
      expect.objectContaining({ options: { paymentRequest, style: { paymentRequestButton: { type: "buy", height: "44px" } } } }),
      expect.anything()
    );
  });

  it("leaves card checkout available when no wallet is supported", async () => {
    const { paymentRequest } = setup({ available: false });

    await waitFor(() => expect(paymentRequest.canMakePayment).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Pay with wallet" })).not.toBeInTheDocument();
  });

  it("falls back silently when wallet detection rejects", async () => {
    const { paymentRequest } = setup({ canMakePayment: vi.fn().mockRejectedValue(new Error("unavailable")) });

    await waitFor(() => expect(paymentRequest.canMakePayment).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Pay with wallet" })).not.toBeInTheDocument();
  });

  it("prevents opening a wallet while checkout is disabled", async () => {
    const { onOpenChange, preventDefault } = setup({ disabled: true });

    fireEvent.click(await screen.findByRole("button", { name: "Pay with wallet" }));

    expect(preventDefault).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("saves the wallet method for the shared charge flow and reports its type", async () => {
    const { authorize, onSubmit, result, event, stripe } = setup();

    await authorize();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "apple_pay" }));
    expect(stripe.confirmCardSetup).toHaveBeenCalledWith("seti_wallet", { payment_method: "pm_wallet" }, { handleActions: false });
    expect(result()).toEqual({ paymentMethodId: "pm_wallet" });
    expect(event.complete).toHaveBeenCalledExactlyOnceWith("success");
    expect(stripe.confirmCardSetup).toHaveBeenCalledOnce();
  });

  it("closes the native wallet before showing setup authentication", async () => {
    const confirmCardSetup = vi
      .fn()
      .mockResolvedValueOnce({ setupIntent: { status: "requires_action" } })
      .mockResolvedValueOnce({ setupIntent: { status: "succeeded", payment_method: "pm_wallet" } });
    const { authorize, event, result } = setup({ confirmCardSetup });

    await authorize();

    expect(confirmCardSetup).toHaveBeenLastCalledWith("seti_wallet");
    expect(event.complete.mock.invocationCallOrder[0]).toBeLessThan(confirmCardSetup.mock.invocationCallOrder[1]);
    expect(result()).toEqual({ paymentMethodId: "pm_wallet" });
  });

  it.each([
    ["applePay", "apple_pay"],
    ["googlePay", "google_pay"],
    ["link", "link"],
    ["browserCard", "card"]
  ])("reports %s when Stripe omits card wallet metadata", async (walletName, type) => {
    const { authorize, onSubmit } = setup({
      walletName,
      paymentMethod: mock<PaymentRequestPaymentMethodEvent["paymentMethod"]>({ id: "pm_wallet", card: undefined })
    });

    await authorize();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type }));
  });

  it("shows a wallet decline inline without submitting a payment method", async () => {
    const { authorize, event, result } = setup({ confirmCardSetup: vi.fn().mockResolvedValue({ error: { message: "Your card was declined." } }) });

    await authorize();

    expect(screen.getByRole("alert")).toHaveTextContent("Your card was declined.");
    expect(result()).toBeNull();
    expect(event.complete).toHaveBeenCalledExactlyOnceWith("fail");
  });

  it("releases the wallet and shows an inline error when setup fails", async () => {
    const { authorize, onOpenChange, event, result } = setup({ createSetupIntent: vi.fn().mockRejectedValue(new Error("network")) });

    await authorize();

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save your wallet/i);
    expect(result()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(event.complete).toHaveBeenCalledExactlyOnceWith("fail");
  });

  it("releases the close guard when the wallet is cancelled", async () => {
    const { cancel, onOpenChange, onSubmit } = setup();

    await cancel();

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([{ applePay: false, googlePay: false, link: false }, {}])(
    "hides the wallet button when capability flags are all unavailable: %j",
    async available => {
      const { paymentRequest } = setup({ canMakePayment: vi.fn().mockResolvedValue(available) });

      await act(async () => {
        await paymentRequest.canMakePayment();
      });

      expect(screen.queryByRole("button", { name: "Pay with wallet" })).not.toBeInTheDocument();
    }
  );

  it("shows the button when only one supported wallet is available", async () => {
    setup({ canMakePayment: vi.fn().mockResolvedValue({ applePay: false, googlePay: true, link: false }) });

    expect(await screen.findByRole("button", { name: "Pay with wallet" })).toBeInTheDocument();
  });

  it("reports the browser wallet type when a card has no wallet metadata", async () => {
    const { authorize, onSubmit } = setup({
      walletName: "googlePay",
      paymentMethod: mock<PaymentRequestPaymentMethodEvent["paymentMethod"]>({ id: "pm_wallet", card: {} })
    });

    await authorize();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "google_pay" }));
  });

  it("rejects a missing setup secret before confirming the wallet", async () => {
    const { authorize, stripe, event, result } = setup({ createSetupIntent: vi.fn().mockResolvedValue({ clientSecret: null }) });

    await authorize();

    expect(result()).toBeNull();
    expect(stripe.confirmCardSetup).not.toHaveBeenCalled();
    expect(event.complete).toHaveBeenCalledExactlyOnceWith("fail");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your wallet. Please check your connection and try again.");
  });

  it("provides an inline fallback for a Stripe setup error without a message", async () => {
    const { authorize, result } = setup({ confirmCardSetup: vi.fn().mockResolvedValue({ error: {} }) });

    await authorize();

    expect(result()).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your wallet. Please try again.");
  });

  it.each([
    { status: "requires_payment_method", payment_method: "pm_wallet" },
    { status: "succeeded", payment_method: null },
    { status: "succeeded", payment_method: { id: "pm_wallet" } }
  ])("does not submit an unusable wallet setup result: %j", async setupIntent => {
    const { authorize, result, event } = setup({ confirmCardSetup: vi.fn().mockResolvedValue({ setupIntent }) });

    await authorize();

    expect(result()).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Wallet authentication did not complete. Please try again.");
    expect(event.complete).toHaveBeenCalledOnce();
  });

  it("shows authentication errors after closing the native wallet", async () => {
    const confirmCardSetup = vi
      .fn()
      .mockResolvedValueOnce({ setupIntent: { status: "requires_action" } })
      .mockResolvedValueOnce({ error: { message: "Authentication was cancelled." } });
    const { authorize, result, event, onOpenChange } = setup({ confirmCardSetup });

    await authorize();

    expect(result()).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Authentication was cancelled.");
    expect(event.complete).toHaveBeenCalledExactlyOnceWith("success");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("clears a prior wallet error on the next authorization", async () => {
    const confirmCardSetup = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Your card was declined." } })
      .mockResolvedValue({ setupIntent: { status: "succeeded", payment_method: "pm_wallet" } });
    const { authorize, result } = setup({ confirmCardSetup });
    await authorize();
    expect(screen.getByRole("alert")).toHaveTextContent("Your card was declined.");

    await authorize();

    expect(result()).toEqual({ paymentMethodId: "pm_wallet" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("detaches wallet listeners when checkout unmounts", async () => {
    const { paymentRequest, unmount, listeners } = setup();
    await screen.findByRole("button", { name: "Pay with wallet" });

    unmount();

    expect(paymentRequest.off).toHaveBeenCalledWith("paymentmethod", listeners.get("paymentmethod"));
    expect(paymentRequest.off).toHaveBeenCalledWith("cancel", listeners.get("cancel"));
  });

  it("does not initialize a wallet if checkout unmounts before Stripe loads", async () => {
    let loadStripe!: (stripe: Stripe) => void;
    const stripePromise = new Promise<Stripe>(resolve => {
      loadStripe = resolve;
    });
    const { stripe, unmount } = setup({ stripePromise });

    unmount();
    await act(async () => {
      loadStripe(stripe);
    });

    expect(stripe.paymentRequest).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      amount?: number;
      available?: boolean;
      disabled?: boolean;
      canMakePayment?: PaymentRequest["canMakePayment"];
      confirmCardSetup?: Stripe["confirmCardSetup"];
      createSetupIntent?: ReturnType<typeof DEPENDENCIES.useServices>["stripe"]["createSetupIntent"];
      walletName?: string;
      paymentMethod?: PaymentRequestPaymentMethodEvent["paymentMethod"];
      stripePromise?: Promise<Stripe>;
    } = {}
  ) {
    const listeners = new Map<string, (...args: never[]) => unknown>();
    const paymentRequest: MockProxy<PaymentRequest> = mock<PaymentRequest>({
      canMakePayment: input.canMakePayment ?? vi.fn().mockResolvedValue(input.available === false ? null : { applePay: true }),
      on: vi.fn((name: string, listener: (...args: never[]) => unknown) => {
        listeners.set(name, listener);
        return paymentRequest;
      })
    });
    const stripe = mock<Stripe>({
      paymentRequest: vi.fn().mockReturnValue(paymentRequest),
      confirmCardSetup: input.confirmCardSetup ?? vi.fn().mockResolvedValue({ setupIntent: { status: "succeeded", payment_method: "pm_wallet" } })
    });
    const stripePromise = input.stripePromise ?? Promise.resolve(stripe);
    const services = mock<ReturnType<typeof DEPENDENCIES.useServices>>({
      stripeService: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({ getStripe: () => stripePromise }),
      stripe: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripe"]>({
        createSetupIntent: input.createSetupIntent ?? vi.fn().mockResolvedValue({ clientSecret: "seti_wallet" })
      })
    });
    const onOpenChange = vi.fn();
    const preventDefault = vi.fn();
    let result: { paymentMethodId: string } | null = null;
    const onSubmit = vi.fn<React.ComponentProps<typeof AddCreditsWalletButton>["onSubmit"]>(async source => {
      result = await source.addPaymentMethod();
    });
    const event = mock<PaymentRequestPaymentMethodEvent>({
      walletName: input.walletName ?? "applePay",
      paymentMethod:
        input.paymentMethod ?? mock<PaymentRequestPaymentMethodEvent["paymentMethod"]>({ id: "pm_wallet", card: { wallet: { type: "apple_pay" } } })
    });
    const PaymentRequestButtonElement = vi.fn<typeof DEPENDENCIES.PaymentRequestButtonElement>(({ onClick }) => (
      <button type="button" onClick={() => onClick?.({ preventDefault })}>
        Pay with wallet
      </button>
    ));
    const view = render(
      <AddCreditsWalletButton
        amount={input.amount ?? 100}
        disabled={input.disabled ?? false}
        onSubmit={onSubmit}
        onOpenChange={onOpenChange}
        dependencies={{
          useServices: () => services,
          Elements: ({ children }) => <>{children}</>,
          PaymentRequestButtonElement
        }}
      />
    );

    return {
      paymentRequest,
      listeners,
      PaymentRequestButtonElement,
      unmount: view.unmount,
      stripe,
      event,
      onSubmit,
      onOpenChange,
      preventDefault,
      result: () => result,
      async authorize() {
        await screen.findByRole("button", { name: "Pay with wallet" });
        const listener = listeners.get("paymentmethod") as (event: PaymentRequestPaymentMethodEvent) => Promise<void>;
        await act(() => listener(event));
      },
      async cancel() {
        await screen.findByRole("button", { name: "Pay with wallet" });
        const listener = listeners.get("cancel") as () => void;
        act(listener);
      }
    };
  }
});
