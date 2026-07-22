import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./ThreeDSecureModal";
import { ThreeDSecureModal } from "./ThreeDSecureModal";

import { act, render, screen } from "@testing-library/react";

interface AuthenticationResult {
  error?: { message?: string };
  paymentIntent?: { status: string; id: string };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe(ThreeDSecureModal.name, () => {
  it("runs the Stripe confirmation exactly once despite parent re-renders with fresh callback identities", () => {
    const confirmPayment = vi.fn(() => new Promise<AuthenticationResult>(() => {}));
    const { rerenderWithCallbacks } = setup({ confirmPayment });

    rerenderWithCallbacks({ onSuccess: vi.fn(), onError: vi.fn() });
    rerenderWithCallbacks({ onSuccess: vi.fn(), onError: vi.fn() });

    expect(confirmPayment).toHaveBeenCalledTimes(1);
  });

  it("confirms the payment intent with the client secret and selected payment method", () => {
    const confirmPayment = vi.fn(() => new Promise<AuthenticationResult>(() => {}));
    setup({ confirmPayment, clientSecret: "pi_secret_abc", paymentMethodId: "pm_abc" });

    expect(confirmPayment).toHaveBeenCalledWith({
      clientSecret: "pi_secret_abc",
      confirmParams: { payment_method: "pm_abc", return_url: window.location.href },
      redirect: "if_required"
    });
  });

  it("routes a successful confirmation to the latest onSuccess after the success delay", async () => {
    vi.useFakeTimers();
    try {
      const deferred = createDeferred<AuthenticationResult>();
      const confirmPayment = vi.fn(() => deferred.promise);
      const staleOnSuccess = vi.fn();
      const latestOnSuccess = vi.fn();
      const { rerenderWithCallbacks } = setup({ confirmPayment, onSuccess: staleOnSuccess });

      rerenderWithCallbacks({ onSuccess: latestOnSuccess, onError: vi.fn() });

      await act(async () => {
        deferred.resolve({ paymentIntent: { status: "succeeded", id: "pi_1" } });
        await deferred.promise;
      });

      expect(screen.getByText("Authentication Successful!")).toBeInTheDocument();
      expect(latestOnSuccess).not.toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(latestOnSuccess).toHaveBeenCalledTimes(1);
      expect(staleOnSuccess).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces the Stripe error message and reports it through onError", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ error: { message: "Your card was declined." } });
    const { onError } = setup({ confirmPayment });

    expect(await screen.findByText("Your card was declined.")).toBeInTheDocument();
    expect(screen.getByText("Authentication Failed")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Your card was declined.");
  });

  it("shows a declined message when the intent still requires a payment method", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ paymentIntent: { status: "requires_payment_method", id: "pi_1" } });
    const { onError } = setup({ confirmPayment });

    expect(await screen.findByText("Your payment method was declined. Please try a different card.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Your payment method was declined. Please try a different card.");
  });

  it("reports an unexpected payment intent status", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ paymentIntent: { status: "requires_action", id: "pi_1" } });
    const { onError } = setup({ confirmPayment });

    expect(await screen.findByText("Authentication failed. Status: requires_action")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Authentication failed. Status: requires_action");
  });

  it("fails with a retry message when no payment intent is returned", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({});
    const { onError } = setup({ confirmPayment });

    expect(await screen.findByText("Authentication failed. Please try again.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Authentication failed. Please try again.");
  });

  it("reports the thrown message when the confirmation rejects", async () => {
    const confirmPayment = vi.fn().mockRejectedValue(new Error("Network down"));
    const { onError } = setup({ confirmPayment });

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Network down");
  });

  it("does not start a second confirmation when unmounted mid-challenge", () => {
    const confirmPayment = vi.fn(() => new Promise<AuthenticationResult>(() => {}));
    const { unmount } = setup({ confirmPayment });

    unmount();

    expect(confirmPayment).toHaveBeenCalledTimes(1);
  });

  it("shows an unavailable message and never confirms when Stripe cannot be loaded", () => {
    const confirmPayment = vi.fn(() => new Promise<AuthenticationResult>(() => {}));
    setup({ confirmPayment, stripeUnavailable: true });

    expect(screen.getByText(/Payment processing is not available at this time/i)).toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("shows a missing-data message and never confirms when the client secret is empty", () => {
    const confirmPayment = vi.fn(() => new Promise<AuthenticationResult>(() => {}));
    setup({ confirmPayment, clientSecret: "" });

    expect(screen.getByText(/Authentication data is missing/i)).toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  function setup(input: {
    clientSecret?: string;
    paymentMethodId?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
    confirmPayment?: (...args: unknown[]) => Promise<unknown>;
    stripeUnavailable?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const clientSecret = input.clientSecret ?? "pi_secret_123";
    const paymentMethodId = input.paymentMethodId ?? "pm_123";
    const onSuccess = input.onSuccess ?? vi.fn();
    const onError = input.onError ?? vi.fn();
    const confirmPayment = input.confirmPayment ?? vi.fn(() => new Promise(() => {}));

    const Elements = (({ children }: { children?: React.ReactNode }) => (
      <div data-testid="stripe-elements">{children}</div>
    )) as unknown as typeof DEPENDENCIES.Elements;

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        stripeService: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]>({
          getStripe: () =>
            input.stripeUnavailable
              ? (null as unknown as ReturnType<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]["getStripe"]>)
              : Promise.resolve(mock<Awaited<ReturnType<ReturnType<typeof DEPENDENCIES.useServices>["stripeService"]["getStripe"]>>>())
        })
      });

    const useTheme: typeof DEPENDENCIES.useTheme = () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: "light" });

    const stripe = { confirmPayment } as unknown as NonNullable<ReturnType<typeof DEPENDENCIES.useStripe>>;
    const useStripe: typeof DEPENDENCIES.useStripe = () => stripe;

    const elements = mock<NonNullable<ReturnType<typeof DEPENDENCIES.useElements>>>();
    const useElements: typeof DEPENDENCIES.useElements = () => elements;

    const dependencies: typeof DEPENDENCIES = { Elements, useServices, useTheme, useStripe, useElements, ...input.dependencies };

    const view = render(
      <ThreeDSecureModal clientSecret={clientSecret} paymentMethodId={paymentMethodId} onSuccess={onSuccess} onError={onError} dependencies={dependencies} />
    );

    const rerenderWithCallbacks = (callbacks: { onSuccess: () => void; onError: (error: string) => void }) =>
      view.rerender(
        <ThreeDSecureModal
          clientSecret={clientSecret}
          paymentMethodId={paymentMethodId}
          onSuccess={callbacks.onSuccess}
          onError={callbacks.onError}
          dependencies={dependencies}
        />
      );

    return { ...view, rerenderWithCallbacks, confirmPayment, onSuccess, onError };
  }
});
