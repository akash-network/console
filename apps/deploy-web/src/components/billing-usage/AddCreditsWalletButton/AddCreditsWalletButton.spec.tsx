import React from "react";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent, Stripe } from "@stripe/stripe-js";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { AddCreditsWalletButton, type DEPENDENCIES } from "./AddCreditsWalletButton";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(AddCreditsWalletButton.name, () => {
  it("shows an available wallet before collecting card details and uses the current amount", async () => {
    const { paymentRequest, onOpenChange } = setup({ amount: 100 });

    fireEvent.click(await screen.findByRole("button", { name: "Pay with wallet" }));

    expect(paymentRequest.update).toHaveBeenCalledWith({ total: { label: "Akash credits", amount: 10000 } });
    expect(onOpenChange).toHaveBeenCalledWith(true);
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
    ["link", "link"]
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
    const stripePromise = Promise.resolve(stripe);
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
    render(
      <AddCreditsWalletButton
        amount={input.amount ?? 100}
        disabled={input.disabled ?? false}
        onSubmit={onSubmit}
        onOpenChange={onOpenChange}
        dependencies={{
          useServices: () => services,
          Elements: ({ children }) => <>{children}</>,
          PaymentRequestButtonElement: ({ onClick }) => (
            <button type="button" onClick={() => onClick?.({ preventDefault })}>
              Pay with wallet
            </button>
          )
        }}
      />
    );

    return {
      paymentRequest,
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
