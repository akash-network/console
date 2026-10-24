import React, { useContext, useEffect, useImperativeHandle } from "react";
import type { BillingTransaction, PaymentMethod } from "@akashnetwork/http-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { handleStripeError } from "@src/utils/stripeErrorHandler";
import { AddCreditsAmountFields } from "../AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentFormLoadError, PaymentMethodSourceHandle } from "../AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import { useTopUpAttemptKey } from "./useTopUpAttemptKey/useTopUpAttemptKey";
import { waitForSettledTransaction } from "./waitForSettledTransaction/waitForSettledTransaction";
import type { DEPENDENCIES } from "./AddCreditsForm";
import { AddCreditsForm } from "./AddCreditsForm";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe(AddCreditsForm.name, () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates a setup intent on mount when the user has no saved payment methods", () => {
    const mutate = vi.fn();
    setup({ status: "idle", mutate });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("does not re-create the setup intent once it has been requested", () => {
    const mutate = vi.fn();
    setup({ status: "pending", mutate });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("keeps new-card entry and the amount when a failed charge refreshes saved methods", async () => {
    const confirmPayment = vi.fn().mockRejectedValue(new Error("declined"));
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" }));
    const { rerender } = setup({ status: "success", clientSecret: "seti_secret", confirmPayment, dependencies: { AddCreditsNewPaymentMethodFields } });

    await submitWithAmount("100");
    const fields = screen.getByTestId("new-payment-method-fields");
    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, paymentMethods: [paymentMethod({ id: "pm_new", isDefault: true })] });

    expect(screen.getByTestId("new-payment-method-fields")).toBe(fields);
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });

  it("shows an inline pending message when confirmation times out", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const input = { status: "idle" as const, confirmPayment, paymentMethods: [paymentMethod()] };
    const { rerender } = setup(input);

    await submitWithAmount("100");
    rerender({ ...input, isPolling: true });
    rerender({ ...input, isPolling: false, lastOutcome: "timeout" });

    expect(screen.getByRole("alert")).toHaveTextContent(/still processing.*no need to pay again/i);
    expect(screen.getByRole("radio", { name: "100" })).toBeChecked();
  });

  it("offers a retry when preparing the card form fails", () => {
    const mutate = vi.fn();
    setup({ status: "error", mutate });

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load the payment form/i);
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(mutate).toHaveBeenCalledOnce();
  });

  it("renders the first-purchase bonus alert with the entered amount regardless of trial state", () => {
    setup({ status: "idle" });

    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("100");
  });

  it("pre-selects the smallest amount that keeps the deployment the credits are for running for a week", () => {
    setup({ status: "idle", deploymentDailyCostUsd: 20 });

    expect(screen.getByRole("radio", { name: /^500 / })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^500 / })).toHaveAccessibleName("500 about 25 days of this deployment");
    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("500");
  });

  it("pre-selects no amount when even the largest one runs the deployment out within a week", () => {
    setup({ status: "idle", deploymentDailyCostUsd: 200 });

    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("0");
  });

  it("pre-selects the default saved payment method", () => {
    setup({
      status: "idle",
      paymentMethods: [
        paymentMethod({ id: "pm_1" }),
        paymentMethod({ id: "pm_2", isDefault: true, card: { brand: "mastercard", last4: "1111", funding: "credit", exp_month: 3, exp_year: 2031 } })
      ]
    });

    expect(screen.getByRole("button", { name: /1111/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /4242/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("prefers a saved Link method over a default card", () => {
    setup({
      status: "idle",
      paymentMethods: [
        paymentMethod({ isDefault: true }),
        paymentMethod({ id: "pm_link", type: "link", card: undefined, link: { email: "payer@example.com" } })
      ]
    });

    expect(screen.getByRole("button", { name: /payer@example.com/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("charges a wallet through the existing payment flow and preserves its type on retry", async () => {
    const confirmPayment = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue({ success: true });
    const analyticsService = mock<AnalyticsService>();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_wallet" });
    const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit }) => (
      <button type="button" onClick={() => void onSubmit({ type: "google_pay", addPaymentMethod })}>
        Google Pay
      </button>
    );
    setup({ status: "idle", confirmPayment, analyticsService, context: "billing", dependencies: { AddCreditsWalletButton } });
    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Google Pay" })));
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!));

    expect(addPaymentMethod).toHaveBeenCalledOnce();
    expect(confirmPayment).toHaveBeenCalledTimes(2);
    expect(confirmPayment.mock.calls[1][0]).toEqual(confirmPayment.mock.calls[0][0]);
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", amount: 100, paymentMethodId: "pm_wallet", idempotencyKey: expect.any(String) });
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", {
      category: "billing",
      amount: 100,
      type: "google_pay",
      isSavedMethod: false,
      context: "billing"
    });
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_method_selected", { category: "billing", type: "google_pay" });
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", {
      category: "billing",
      amount: 100,
      type: "google_pay",
      isSavedMethod: true,
      context: "billing"
    });
  });

  it("releases the form and reports an inline error when payment method setup rejects", async () => {
    const confirmPayment = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(vi.fn().mockRejectedValue(new Error("network")));
    setup({ status: "success", clientSecret: "seti_secret", confirmPayment, analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });

    await submitWithAmount("100");

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't prepare your payment/i);
    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeEnabled();
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", expect.objectContaining({ stage: "payment_method_setup" }));
  });

  it("blocks fresh wallet authorization and resumes the original attempt after reopening", async () => {
    const confirmPayment = vi.fn().mockRejectedValue(new Error("network"));
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_wallet" });
    const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit, disabled }) => (
      <button type="button" disabled={disabled} onClick={() => void onSubmit({ type: "apple_pay", addPaymentMethod })}>
        Pay with Apple Pay
      </button>
    );
    const input = { status: "idle" as const, confirmPayment, dependencies: { AddCreditsWalletButton } };
    const first = setup(input);
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" })));

    expect(screen.getByRole("button", { name: "Pay with Apple Pay" })).toBeDisabled();
    expect(screen.getByText(/Your wallet payment is awaiting confirmation/)).toBeInTheDocument();
    first.unmount();
    setup(input);
    await submitWithAmount("100");

    expect(screen.getByRole("button", { name: "Pay with Apple Pay" })).toBeDisabled();
    expect(addPaymentMethod).toHaveBeenCalledOnce();
    expect(confirmPayment).toHaveBeenCalledTimes(2);
    expect(confirmPayment.mock.calls[1][0]).toEqual(confirmPayment.mock.calls[0][0]);
  });

  it.each([
    ["apple_pay", "Apple Pay"],
    ["google_pay", "Google Pay"],
    ["link", "Wallet"]
  ])("retains the %s method for retry after a definitive decline", async (type, label) => {
    const confirmPayment = vi.fn().mockRejectedValue({ response: { status: 402 } });
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_wallet" });
    const analyticsService = mock<AnalyticsService>();
    const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit }) => (
      <button type="button" onClick={() => void onSubmit({ type, addPaymentMethod })}>
        Express checkout
      </button>
    );
    setup({ status: "idle", confirmPayment, analyticsService, dependencies: { AddCreditsWalletButton } });
    expect(screen.queryByText(/wallet payment is awaiting confirmation/)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment method")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Express checkout" })));

    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("new-payment-method-fields")).not.toBeInTheDocument();
    expect(screen.queryByText(/wallet payment is awaiting confirmation/)).not.toBeInTheDocument();
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!));
    expect(addPaymentMethod).toHaveBeenCalledOnce();
    expect(confirmPayment).toHaveBeenCalledTimes(2);
    expect(confirmPayment.mock.calls[1][0].paymentMethodId).toBe("pm_wallet");
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", expect.objectContaining({ type, isSavedMethod: true }));
  });

  it("does not duplicate a wallet already returned by saved payment methods", async () => {
    const confirmPayment = vi.fn().mockRejectedValue({ response: { status: 402 } });
    const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit }) => (
      <button type="button" onClick={() => void onSubmit({ type: "apple_pay", addPaymentMethod: async () => ({ paymentMethodId: "pm_wallet" }) })}>
        Express checkout
      </button>
    );
    const input = { status: "idle" as const, confirmPayment, paymentMethods: [paymentMethod()], dependencies: { AddCreditsWalletButton } };
    const { rerender } = setup(input);
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Express checkout" })));
    expect(screen.getByRole("button", { name: "Apple Pay" })).toHaveAttribute("aria-pressed", "true");

    rerender({
      ...input,
      paymentMethods: [
        ...input.paymentMethods,
        paymentMethod({ id: "pm_wallet", card: { brand: "visa", last4: "1111", funding: "credit", exp_month: 1, exp_year: 2030 } })
      ]
    });

    expect(screen.queryByRole("button", { name: "Apple Pay" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1111/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("guards a pending wallet even when authorization bypasses the disabled button", async () => {
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_wallet" });
    const confirmPayment = vi.fn().mockRejectedValue(new Error("network"));
    const AddCreditsWalletButton = vi.fn<typeof DEPENDENCIES.AddCreditsWalletButton>(() => null);
    setup({ status: "idle", confirmPayment, dependencies: { AddCreditsWalletButton } });
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    const source = { type: "apple_pay", addPaymentMethod };
    await act(async () => AddCreditsWalletButton.mock.calls.at(-1)![0].onSubmit(source));

    await act(async () => AddCreditsWalletButton.mock.calls.at(-1)![0].onSubmit(source));

    expect(addPaymentMethod).toHaveBeenCalledOnce();
    expect(confirmPayment).toHaveBeenCalledOnce();
  });

  it("enables wallet checkout only at the minimum amount after saved methods finish loading", () => {
    const AddCreditsWalletButton = vi.fn<typeof DEPENDENCIES.AddCreditsWalletButton>(() => null);
    const input = { status: "idle" as const, topUpMinAmountUsd: 100, dependencies: { AddCreditsWalletButton } };
    const { rerender } = setup(input);
    expect(AddCreditsWalletButton.mock.calls.at(-1)![0].disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    expect(AddCreditsWalletButton.mock.calls.at(-1)![0].disabled).toBe(false);
    rerender({ ...input, isLoadingMethods: true });
    expect(AddCreditsWalletButton.mock.calls.at(-1)![0].disabled).toBe(true);
    rerender({ ...input, paymentMethods: [paymentMethod()] });
    expect(AddCreditsWalletButton.mock.calls.at(-1)![0].disabled).toBe(false);
  });

  it("locks card entry and blocks form submission while the native wallet is open", async () => {
    const addPaymentMethod = vi.fn();
    const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(addPaymentMethod);
    const AddCreditsWalletButton = vi.fn<typeof DEPENDENCIES.AddCreditsWalletButton>(() => null);
    const onProcessingChange = vi.fn();
    setup({ status: "success", clientSecret: "seti_secret", onProcessingChange, dependencies: { AddCreditsWalletButton, AddCreditsNewPaymentMethodFields } });
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    expect(lastProps()!.disabled).toBe(false);
    act(() => AddCreditsWalletButton.mock.calls.at(-1)![0].onOpenChange(true));

    let submitted = true;
    await act(async () => {
      submitted = fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(submitted).toBe(false);
    expect(addPaymentMethod).not.toHaveBeenCalled();
    expect(lastProps()!.disabled).toBe(true);
    expect(AddCreditsWalletButton.mock.calls.at(-1)![0].disabled).toBe(true);
    expect(onProcessingChange).toHaveBeenLastCalledWith(true);
    act(() => AddCreditsWalletButton.mock.calls.at(-1)![0].onOpenChange(false));
    expect(lastProps()!.disabled).toBe(false);
    expect(onProcessingChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps a confirmed card locked until the user explicitly chooses a different method", async () => {
    const reset = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
    const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(addPaymentMethod);
    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      reset,
      confirmPayment: vi.fn().mockRejectedValue(new Error("declined")),
      dependencies: { AddCreditsNewPaymentMethodFields }
    });
    expect(screen.queryByRole("button", { name: "Use a different payment method" })).not.toBeInTheDocument();
    expect(lastProps()!.disabled).toBe(false);

    await submitWithAmount("100");

    expect(lastProps()!.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Use a different payment method" }));
    expect(reset).toHaveBeenCalledOnce();
    rerender({ status: "pending", reset });
    expect(lastProps()!.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Use a different payment method" })).not.toBeInTheDocument();
  });

  it("allows a purchase at the exact minimum amount", () => {
    setup({ status: "idle", topUpMinAmountUsd: 100, paymentMethods: [paymentMethod()] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeEnabled();
  });

  it("uses inline messages instead of 3DS snackbars", () => {
    const { use3DSecure, threeDSecureOptions } = capture3DSecure();
    setup({ status: "idle", dependencies: { use3DSecure } });

    expect(threeDSecureOptions()).toMatchObject({ showSuccessMessage: false, showErrorMessage: false });
  });

  it("does not create a setup intent while a saved method is selected", () => {
    const mutate = vi.fn();
    setup({ status: "idle", mutate, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("new-payment-method-fields")).not.toBeInTheDocument();
  });

  it("switches to new-card entry and creates a setup intent when 'Add new payment method' is chosen", () => {
    const mutate = vi.fn();
    setup({ status: "idle", mutate, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("new-payment-method-fields")).toBeInTheDocument();
  });

  it("charges the selected saved method without collecting a new card", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const addPaymentMethod = vi.fn();
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "idle",
      confirmPayment,
      paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).not.toHaveBeenCalled();
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_saved", amount: 100, idempotencyKey: expect.any(String) });
  });

  it("passes a loading flag to the payment-method fields while the setup intent is being prepared", () => {
    const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock();
    setup({ status: "pending", dependencies: { AddCreditsNewPaymentMethodFields } });

    expect(lastProps()!.isLoading).toBe(true);
  });

  it("disables the submit button until an amount is chosen", () => {
    setup({ status: "success", clientSecret: "seti_secret" });

    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeDisabled();
  });

  it("on submit: adds the payment method, charges via confirmPayment, and starts polling without calling onDone yet", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const pollForPayment = vi.fn();
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      pollForPayment,
      onDone,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1", amount: 100, idempotencyKey: expect.any(String) });
    expect(pollForPayment).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onDone after polling stops and the user is no longer trialing", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      isTrialing: true,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: true, isPolling: true });
    expect(onDone).not.toHaveBeenCalled();

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: false, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, 0));
  });

  it("waits for the payment's own row to settle before reporting its bonus", async () => {
    const getCustomerTransactions = vi
      .fn()
      .mockResolvedValueOnce({ transactions: [{ id: "tx_1", status: "created", amount: 10000, bonusAmount: 0 }] })
      .mockResolvedValue({ transactions: [{ id: "tx_1", status: "succeeded", amount: 10000, bonusAmount: 1000 }] });
    const { onDone } = await purchaseUntilPollingSettles({
      confirmPayment: vi.fn().mockResolvedValue({ success: true, transactionId: "tx_1", transactionStatus: "created" }),
      getCustomerTransactions,
      dependencies: { waitForSettledTransaction }
    });

    await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 3_000 });
    expect(onDone).toHaveBeenCalledWith(100, 10);
    expect(getCustomerTransactions).toHaveBeenCalledTimes(2);
  });

  it("completes without a bonus when the payment's own row does not settle in time", async () => {
    const waitForSettledTransaction = vi.fn<typeof DEPENDENCIES.waitForSettledTransaction>().mockResolvedValue(undefined);
    const { onDone } = await purchaseUntilPollingSettles({
      confirmPayment: vi.fn().mockResolvedValue({ success: true, transactionId: "tx_1", transactionStatus: "created" }),
      dependencies: { waitForSettledTransaction }
    });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, 0));
    expect(waitForSettledTransaction).toHaveBeenCalledWith(expect.anything(), "tx_1");
  });

  it("completes without waiting when the charge reports no transaction", async () => {
    const waitForSettledTransaction = vi.fn<typeof DEPENDENCIES.waitForSettledTransaction>();
    const { onDone } = await purchaseUntilPollingSettles({
      confirmPayment: vi.fn().mockResolvedValue({ success: true }),
      dependencies: { waitForSettledTransaction }
    });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, 0));
    expect(waitForSettledTransaction).not.toHaveBeenCalled();
  });

  it("waits for the payment's own row after a 3D Secure challenge", async () => {
    const settled = transaction({ id: "tx_3ds", bonusAmount: 500 });
    const waitForSettledTransaction = vi.fn<typeof DEPENDENCIES.waitForSettledTransaction>().mockResolvedValue(settled);
    const { use3DSecure, threeDSecureOptions } = capture3DSecure();
    const onDone = vi.fn();
    const input: SetupInput = {
      status: "idle",
      confirmPayment: vi.fn().mockResolvedValue({ requiresAction: true, clientSecret: "pi_secret", paymentIntentId: "pi_1", transactionId: "tx_3ds" }),
      onDone,
      paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
      dependencies: { use3DSecure, waitForSettledTransaction }
    };
    const { rerender } = setup(input);

    await submitWithAmount("100");
    await act(async () => {
      threeDSecureOptions()?.onSuccess?.();
    });
    rerender({ ...input, isPolling: true });
    rerender({ ...input, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, 5));
    expect(waitForSettledTransaction).toHaveBeenCalledWith(expect.anything(), "tx_3ds");
  });

  it("refreshes the payment history once the payment's own row settles", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    let settle: (transaction: BillingTransaction) => void = () => {};
    const waitForSettledTransaction = vi.fn<typeof DEPENDENCIES.waitForSettledTransaction>(
      () =>
        new Promise(resolve => {
          settle = resolve;
        })
    );
    const { onDone } = await purchaseUntilPollingSettles({
      confirmPayment: vi.fn().mockResolvedValue({ success: true, transactionId: "tx_1", transactionStatus: "created" }),
      invalidateQueries,
      dependencies: { waitForSettledTransaction }
    });

    await waitFor(() => expect(waitForSettledTransaction).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["v1", "listStripeTransactions"] });
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => {
      settle(transaction({ id: "tx_1" }));
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listStripeTransactions"] });
    expect(onDone).toHaveBeenCalledWith(100, 0);
  });

  it("refreshes the first-purchase bonus offer once the payment settles", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      invalidateQueries,
      isTrialing: false,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, invalidateQueries, isTrialing: false, isPolling: true });
    expect(invalidateQueries).not.toHaveBeenCalled();

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, invalidateQueries, isTrialing: false, isPolling: false });

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "getFirstPurchaseBonus"] }));
  });

  it("shows an error when polling confirms payment but the trial does not flip", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      isTrialing: true,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: true, isPolling: true });
    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: true, isPolling: false });

    expect(await screen.findByText(/payment did not complete in time/i)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("does not call the API when the payment method cannot be set up", async () => {
    const confirmPayment = vi.fn();
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ failure: { errorType: "card_error", errorCode: "incorrect_cvc" } });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("hands off to 3D Secure when the charge requires action and does not call onDone yet", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({
      requiresAction: true,
      clientSecret: "pi_secret",
      paymentIntentId: "pi_1"
    });
    const start3DSecure = vi.fn();
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_3ds" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      start3DSecure,
      onDone,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(start3DSecure).toHaveBeenCalledWith({
      clientSecret: "pi_secret",
      paymentIntentId: "pi_1",
      paymentMethodId: "pm_3ds"
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("surfaces a stripe-handled error when the charge throws", async () => {
    const confirmPayment = vi.fn().mockRejectedValue(new Error("boom"));
    const handleStripeError = vi.fn().mockReturnValue({ message: "Card declined.", userAction: "Try a different card." });
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_x" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      handleStripeError,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(handleStripeError).toHaveBeenCalled();
    expect(await screen.findByText("Card declined.")).toBeInTheDocument();
    expect(screen.getByText("Try a different card.")).toBeInTheDocument();
  });

  it("does not submit when no amount is chosen", async () => {
    const confirmPayment = vi.fn();
    const addPaymentMethod = vi.fn();
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    await waitFor(() => expect(addPaymentMethod).not.toHaveBeenCalled());
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("does not submit when the custom amount is below the 20-credit minimum", async () => {
    const confirmPayment = vi.fn();
    const addPaymentMethod = vi.fn();
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.change(screen.getByLabelText(/custom-amount/i), { target: { value: "19" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Minimum amount is $20");
    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeDisabled();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    await waitFor(() => expect(addPaymentMethod).not.toHaveBeenCalled());
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("validates against the wallet-provided minimum and clears the error once met", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });

    setup({
      status: "idle",
      topUpMinAmountUsd: 50,
      confirmPayment,
      paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
    });

    fireEvent.change(screen.getByLabelText(/custom-amount/i), { target: { value: "30" } });

    expect(screen.getByText(/minimum 50/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum amount is $50");
    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/custom-amount/i), { target: { value: "50" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_saved", amount: 50, idempotencyKey: expect.any(String) });
  });

  it("shows a notice and falls back to new-card entry when saved payment methods fail to load", () => {
    setup({ status: "success", clientSecret: "seti_secret", isMethodsError: true });

    expect(screen.getByText(/couldn't load your saved payment methods/i)).toBeInTheDocument();
    expect(screen.getByTestId("new-payment-method-fields")).toBeInTheDocument();
  });

  it("shows no minimum error before any amount is entered", () => {
    setup({ status: "success", clientSecret: "seti_secret", topUpMinAmountUsd: 100 });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not re-confirm the setup intent when retrying after a failed charge", async () => {
    const confirmPayment = vi.fn().mockRejectedValueOnce(new Error("declined")).mockResolvedValue({ success: true });
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(await screen.findByText("fallback")).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).toHaveBeenCalledTimes(2);
    expect(confirmPayment).toHaveBeenLastCalledWith({ userId: "user_1", paymentMethodId: "pm_new", amount: 100, idempotencyKey: expect.any(String) });
  });

  it("refreshes the payment methods when a new-card charge fails", async () => {
    const refreshPaymentMethods = vi.fn().mockResolvedValue(undefined);
    const confirmPayment = vi.fn().mockRejectedValue(new Error("declined"));
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      refreshPaymentMethods,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(refreshPaymentMethods).toHaveBeenCalled();
  });

  it("recreates the setup intent when 'Add new payment method' is re-selected after a card was confirmed", async () => {
    const reset = vi.fn();
    const confirmPayment = vi.fn().mockRejectedValue(new Error("declined"));
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      reset,
      confirmPayment,
      paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));

    expect(reset).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(2);
  });

  it("reports processing to the parent once a charge is underway", async () => {
    const onProcessingChange = vi.fn();
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onProcessingChange,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(onProcessingChange).toHaveBeenCalledWith(true);
  });

  it("tracks the selected amount when a predefined amount is chosen", () => {
    const analyticsService = mock<AnalyticsService>();
    setup({ status: "idle", analyticsService, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_amount_selected", { category: "billing", amount: 100, isCustom: false });
  });

  it("tracks the payment method type when a saved bank method is selected", () => {
    const analyticsService = mock<AnalyticsService>();
    setup({
      status: "idle",
      analyticsService,
      paymentMethods: [paymentMethod({ id: "pm_default", isDefault: true }), paymentMethod({ id: "pm_bank", type: "us_bank_account", card: undefined })]
    });

    fireEvent.click(screen.getByRole("button", { name: /us_bank_account/i }));

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_method_selected", { category: "billing", type: "bank" });
  });

  it("re-reports a new-card payment type after switching to a saved method and back", () => {
    const analyticsService = mock<AnalyticsService>();
    const NewCardFields: typeof DEPENDENCIES.AddCreditsNewPaymentMethodFields = React.forwardRef<
      PaymentMethodSourceHandle,
      { clientSecret?: string; isLoading: boolean; onPaymentTypeChange?: (type: string) => void }
    >(function NewCardFields({ onPaymentTypeChange }) {
      return (
        <button type="button" onClick={() => onPaymentTypeChange?.("card")}>
          emit card
        </button>
      );
    });

    setup({
      status: "idle",
      analyticsService,
      paymentMethods: [paymentMethod({ id: "pm_bank", type: "us_bank_account", card: undefined })],
      dependencies: { AddCreditsNewPaymentMethodFields: NewCardFields }
    });

    fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
    fireEvent.click(screen.getByRole("button", { name: /emit card/i }));
    fireEvent.click(screen.getByRole("button", { name: /emit card/i }));
    fireEvent.click(screen.getByRole("button", { name: /us_bank_account/i }));
    fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
    fireEvent.click(screen.getByRole("button", { name: /emit card/i }));

    const cardEvents = analyticsService.track.mock.calls.filter(
      ([event, props]) => event === "add_credits_payment_method_selected" && (props as { type?: string })?.type === "card"
    );
    expect(cardEvents).toHaveLength(2);
  });

  it("sends a uuid attempt key with the charge", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    setup({ status: "idle", confirmPayment, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment.mock.calls[0][0].idempotencyKey).toMatch(UUID_PATTERN);
  });

  it("reuses the same key when retrying after unknown-outcome failures", async () => {
    const confirmPayment = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({ success: true });
    setup({ status: "idle", confirmPayment, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => {
        fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
      });
    }

    expect(confirmPayment).toHaveBeenCalledTimes(3);
    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("rotates the key after a definitive 402 decline", async () => {
    const confirmPayment = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 402, data: { code: "insufficient_funds" } } })
      .mockResolvedValue({ success: true });
    setup({ status: "idle", confirmPayment, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[0]).toMatch(UUID_PATTERN);
    expect(keys[1]).toMatch(UUID_PATTERN);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("retries the polling-timeout attempt with the same key", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
    const { rerender } = setup({ status: "idle", confirmPayment, isTrialing: true, isPolling: false, paymentMethods: methods });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "idle", confirmPayment, isTrialing: true, isPolling: true, lastOutcome: null, paymentMethods: methods });
    rerender({ status: "idle", confirmPayment, isTrialing: true, isPolling: false, lastOutcome: "timeout", paymentMethods: methods });

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment).toHaveBeenCalledTimes(2);
    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).toBe(keys[0]);
  });

  it("does not complete or rotate the key when polling exhausts without confirming the payment", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
    const { rerender } = setup({ status: "idle", confirmPayment, onDone, isTrialing: false, isPolling: false, paymentMethods: methods });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "idle", confirmPayment, onDone, isTrialing: false, isPolling: true, lastOutcome: null, paymentMethods: methods });
    rerender({ status: "idle", confirmPayment, onDone, isTrialing: false, isPolling: false, lastOutcome: "timeout", paymentMethods: methods });

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/payment did not complete in time/i)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).toBe(keys[0]);
  });

  it("mints a fresh key for the next purchase after the flow completes", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
    const { rerender } = setup({ status: "idle", confirmPayment, onDone, isTrialing: true, isPolling: false, paymentMethods: methods });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "idle", confirmPayment, onDone, isTrialing: true, isPolling: true, paymentMethods: methods });
    rerender({ status: "idle", confirmPayment, onDone, isTrialing: false, isPolling: false, paymentMethods: methods });

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment).toHaveBeenCalledTimes(2);
    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("replays the same key after a remount with identical purchase params", async () => {
    const confirmPayment = vi.fn().mockRejectedValue({ response: { status: 500 } });
    const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
    const first = setup({ status: "idle", confirmPayment, paymentMethods: methods });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });
    first.unmount();

    setup({ status: "idle", confirmPayment, paymentMethods: methods });
    fireEvent.click(screen.getByRole("radio", { name: "100" }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment).toHaveBeenCalledTimes(2);
    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).toBe(keys[0]);
  });

  it("starts polling from the pre-charge baseline when the server replays an already-credited attempt", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true, transactionStatus: "succeeded" });
    const pollForPayment = vi.fn();
    setup({ status: "idle", confirmPayment, pollForPayment, walletBalanceUsd: 500, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(pollForPayment).toHaveBeenCalledWith({ initialBalance: 400 });
  });

  it("polls with the default baseline on a fresh successful charge", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true, transactionStatus: "pending" });
    const pollForPayment = vi.fn();
    setup({ status: "idle", confirmPayment, pollForPayment, walletBalanceUsd: 500, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(pollForPayment).toHaveBeenCalledWith();
  });

  it("keeps the key and shows the still-processing copy on a 409 conflict", async () => {
    const confirmPayment = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 409, data: { code: "conflict", message: "A payment for this request is already in progress." } } })
      .mockResolvedValue({ success: true });
    setup({ status: "idle", confirmPayment, handleStripeError, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })] });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(await screen.findByText("Your payment is still being processed.")).toBeInTheDocument();
    expect(screen.getByText("Wait a moment, then check your balance before retrying.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).toBe(keys[0]);
  });

  it("keeps the key when 3D Secure fails so the retry resumes the same attempt", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ requiresAction: true, clientSecret: "pi_secret", paymentIntentId: "pi_1" });
    let threeDSecureOptions: Parameters<typeof DEPENDENCIES.use3DSecure>[0] | undefined;
    const use3DSecure: typeof DEPENDENCIES.use3DSecure = options => {
      threeDSecureOptions = options;
      return mock<ReturnType<typeof DEPENDENCIES.use3DSecure>>({
        isOpen: false,
        threeDSData: null,
        isLoading: false,
        start3DSecure: vi.fn(),
        close3DSecure: vi.fn(),
        handle3DSSuccess: vi.fn(),
        handle3DSError: vi.fn()
      });
    };

    setup({
      status: "idle",
      confirmPayment,
      paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
      dependencies: { use3DSecure }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    await act(async () => {
      threeDSecureOptions?.onError?.("Authentication failed");
    });

    expect(await screen.findByText("Authentication failed")).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(confirmPayment).toHaveBeenCalledTimes(2);
    const keys = confirmPayment.mock.calls.map(call => call[0].idempotencyKey);
    expect(keys[1]).toBe(keys[0]);
  });

  describe("payment outcome tracking", () => {
    it("tracks the submitted payment with the saved method's type and where the modal was opened from", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockResolvedValue({ success: true }),
        analyticsService,
        context: "review_funding_impact",
        paymentMethods: [paymentMethod({ id: "pm_card" }), paymentMethod({ id: "pm_bank", type: "us_bank_account", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", {
        category: "billing",
        amount: 100,
        type: "bank",
        isSavedMethod: true,
        context: "review_funding_impact"
      });
    });

    it("tracks a new card submission with the type reported by the payment element", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" }));
      setup({
        status: "success",
        clientSecret: "seti_secret",
        confirmPayment: vi.fn().mockResolvedValue({ success: true }),
        analyticsService,
        dependencies: { AddCreditsNewPaymentMethodFields }
      });

      act(() => lastProps()!.onPaymentTypeChange?.("link"));
      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", {
        category: "billing",
        amount: 100,
        type: "link",
        isSavedMethod: false
      });
    });

    it("tracks a new card submission as card when the payment element reported no type", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" }));
      setup({
        status: "success",
        clientSecret: "seti_secret",
        confirmPayment: vi.fn().mockResolvedValue({ success: true }),
        analyticsService,
        dependencies: { AddCreditsNewPaymentMethodFields }
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_submitted", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: false
      });
    });

    it("tracks a setup failure with Stripe's codes when the new payment method cannot be confirmed", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(
        vi.fn().mockResolvedValue({ failure: { errorType: "card_error", errorCode: "card_declined", declineCode: "generic_decline" } })
      );
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: false,
        stage: "payment_method_setup",
        errorType: "card_error",
        errorCode: "card_declined",
        declineCode: "generic_decline"
      });
    });

    it("tracks a wallet setup failure with Stripe's codes", async () => {
      const analyticsService = mock<AnalyticsService>();
      const addPaymentMethod = vi.fn().mockResolvedValue({ failure: { errorType: "card_error", errorCode: "card_declined", declineCode: "do_not_honor" } });
      const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit }) => (
        <button type="button" onClick={() => void onSubmit({ type: "apple_pay", addPaymentMethod })}>
          Express checkout
        </button>
      );
      setup({
        status: "idle",
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
        dependencies: { AddCreditsWalletButton }
      });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));

      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Express checkout" })));

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "apple_pay",
        isSavedMethod: false,
        stage: "payment_method_setup",
        errorType: "card_error",
        errorCode: "card_declined",
        declineCode: "do_not_honor"
      });
    });

    it("tracks the payment form as not ready when the new card fields expose no handle", async () => {
      const analyticsService = mock<AnalyticsService>();
      const AddCreditsNewPaymentMethodFields: typeof DEPENDENCIES.AddCreditsNewPaymentMethodFields = React.forwardRef<
        PaymentMethodSourceHandle,
        { isLoading: boolean; onReady?: () => void; onLoadFailed: (error: PaymentFormLoadError) => void }
      >(function FieldsWithoutHandle({ onReady }) {
        useEffect(() => onReady?.(), [onReady]);
        return null;
      });
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: false,
        stage: "payment_method_setup",
        errorType: "form_not_ready"
      });
    });

    it("tracks a declined charge with where the modal was opened from", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockResolvedValue({ success: false }),
        analyticsService,
        context: "auto_deploy_needs_funds",
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        context: "auto_deploy_needs_funds",
        stage: "charge_declined"
      });
    });

    it("tracks the error code and status when the charge request fails", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockRejectedValue({ response: { status: 402, data: { code: "card_declined" } } }),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "charge_error",
        errorCode: "card_declined",
        httpStatus: 402
      });
    });

    it("tracks a charge error without details when the failure has no response", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockRejectedValue(new Error("network down")),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "charge_error"
      });
    });

    it("tracks only the status when the failed response carries no error body", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockRejectedValue({ response: { status: 503 } }),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "charge_error",
        httpStatus: 503
      });
    });

    it("tracks a charge error when the request rejects without a reason", async () => {
      const analyticsService = mock<AnalyticsService>();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockRejectedValue(undefined),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "charge_error"
      });
    });

    it("tracks 3D Secure being required and then completed with a succeeded result", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { use3DSecure, threeDSecureOptions } = capture3DSecure();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockResolvedValue({ requiresAction: true, clientSecret: "pi_secret", paymentIntentId: "pi_1" }),
        analyticsService,
        context: "review_funding_impact",
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
        dependencies: { use3DSecure }
      });

      await submitWithAmount("100");
      await act(async () => {
        threeDSecureOptions()?.onSuccess?.();
      });

      const paymentProperties = { category: "billing", amount: 100, type: "card", isSavedMethod: true, context: "review_funding_impact" };
      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_3ds_required", paymentProperties);
      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_3ds_completed", { ...paymentProperties, result: "succeeded" });
    });

    it("tracks a failed 3D Secure challenge as completed with a failed result", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { use3DSecure, threeDSecureOptions } = capture3DSecure();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockResolvedValue({ requiresAction: true, clientSecret: "pi_secret", paymentIntentId: "pi_1" }),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
        dependencies: { use3DSecure }
      });

      await submitWithAmount("100");
      await act(async () => {
        threeDSecureOptions()?.onError?.("Authentication failed");
      });

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_3ds_completed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        result: "failed"
      });
    });

    it("tracks a failed 3D Secure challenge as a payment failure", async () => {
      const analyticsService = mock<AnalyticsService>();
      const { use3DSecure, threeDSecureOptions } = capture3DSecure();
      setup({
        status: "idle",
        confirmPayment: vi.fn().mockResolvedValue({ requiresAction: true, clientSecret: "pi_secret", paymentIntentId: "pi_1" }),
        analyticsService,
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })],
        dependencies: { use3DSecure }
      });

      await submitWithAmount("100");
      await act(async () => {
        threeDSecureOptions()?.onError?.("Authentication failed");
      });

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "three_d_secure"
      });
    });

    it("tracks a confirmation timeout when polling exhausts", async () => {
      const analyticsService = mock<AnalyticsService>();
      const confirmPayment = vi.fn().mockResolvedValue({ success: true });
      const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
      const { rerender } = setup({ status: "idle", confirmPayment, analyticsService, isPolling: false, paymentMethods: methods });

      await submitWithAmount("100");
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: true, lastOutcome: null, paymentMethods: methods });
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: false, lastOutcome: "timeout", paymentMethods: methods });

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "confirmation_timeout"
      });
    });

    it("tracks a trial activation timeout when payment settles but the trial does not end", async () => {
      const analyticsService = mock<AnalyticsService>();
      const confirmPayment = vi.fn().mockResolvedValue({ success: true });
      const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
      const { rerender } = setup({ status: "idle", confirmPayment, analyticsService, isTrialing: true, isPolling: false, paymentMethods: methods });

      await submitWithAmount("100");
      rerender({ status: "idle", confirmPayment, analyticsService, isTrialing: true, isPolling: true, lastOutcome: null, paymentMethods: methods });
      rerender({ status: "idle", confirmPayment, analyticsService, isTrialing: true, isPolling: false, lastOutcome: "success", paymentMethods: methods });

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_failed", {
        category: "billing",
        amount: 100,
        type: "card",
        isSavedMethod: true,
        stage: "trial_activation_timeout"
      });
    });

    it("does not track a failure when the purchase completes", async () => {
      const analyticsService = mock<AnalyticsService>();
      const confirmPayment = vi.fn().mockResolvedValue({ success: true });
      const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
      const { rerender } = setup({ status: "idle", confirmPayment, analyticsService, isPolling: false, paymentMethods: methods });

      await submitWithAmount("100");
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: true, lastOutcome: null, paymentMethods: methods });
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: false, lastOutcome: "success", paymentMethods: methods });

      expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_payment_failed", expect.anything());
    });

    it("tracks the completed purchase with the payment details and where the modal was opened from", async () => {
      const analyticsService = mock<AnalyticsService>();
      const confirmPayment = vi.fn().mockResolvedValue({ success: true });
      const methods = [paymentMethod({ id: "pm_bank", type: "us_bank_account", isDefault: true })];
      const { rerender } = setup({
        status: "idle",
        confirmPayment,
        analyticsService,
        context: "auto_deploy_needs_funds",
        isPolling: false,
        paymentMethods: methods
      });

      await submitWithAmount("100");
      rerender({
        status: "idle",
        confirmPayment,
        analyticsService,
        context: "auto_deploy_needs_funds",
        isPolling: true,
        lastOutcome: null,
        paymentMethods: methods
      });
      rerender({
        status: "idle",
        confirmPayment,
        analyticsService,
        context: "auto_deploy_needs_funds",
        isPolling: false,
        lastOutcome: "success",
        paymentMethods: methods
      });

      await waitFor(() =>
        expect(analyticsService.track).toHaveBeenCalledWith("add_credits_purchased", {
          category: "billing",
          amount: 100,
          type: "bank",
          isSavedMethod: true,
          context: "auto_deploy_needs_funds"
        })
      );
    });

    it("does not track a purchase when polling exhausts without confirming the payment", async () => {
      const analyticsService = mock<AnalyticsService>();
      const confirmPayment = vi.fn().mockResolvedValue({ success: true });
      const methods = [paymentMethod({ id: "pm_saved", isDefault: true })];
      const { rerender } = setup({ status: "idle", confirmPayment, analyticsService, isPolling: false, paymentMethods: methods });

      await submitWithAmount("100");
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: true, lastOutcome: null, paymentMethods: methods });
      rerender({ status: "idle", confirmPayment, analyticsService, isPolling: false, lastOutcome: "timeout", paymentMethods: methods });

      expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_purchased", expect.anything());
    });
  });

  describe("when the bank refuses a card", () => {
    const BANK_REFUSED_MESSAGE = "Your bank refused this card. Try a different card or payment method.";
    const BANK_REFUSAL = { failure: { errorType: "card_error", errorCode: "card_declined", declineCode: "generic_decline" } };

    it("moves a refused saved card off the default selection and says the bank refused it", async () => {
      const reset = vi.fn();
      const mutate = vi.fn();
      setup({
        status: "idle",
        reset,
        mutate,
        confirmPayment: vi.fn().mockRejectedValue({ response: { status: 402, data: { code: "card_declined" } } }),
        handleStripeError: () => ({ message: "Your card was declined.", userAction: "Contact your bank or try a different card." }),
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(screen.getByRole("button", { name: /add new payment method/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /4242/ })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("new-payment-method-fields")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(BANK_REFUSED_MESSAGE);
      expect(screen.queryByText("Your card was declined.")).not.toBeInTheDocument();
      expect(reset).toHaveBeenCalledOnce();
      expect(mutate).toHaveBeenCalledOnce();
    });

    it("keeps the saved card selected when its charge fails for another reason", async () => {
      const reset = vi.fn();
      setup({
        status: "idle",
        reset,
        confirmPayment: vi.fn().mockRejectedValue({ response: { status: 402, data: { code: "insufficient_funds" } } }),
        handleStripeError: () => ({ message: "Your card has insufficient funds.", userAction: undefined }),
        paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })]
      });

      await submitWithAmount("100");

      expect(screen.getByRole("button", { name: /4242/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Your card has insufficient funds.");
      expect(reset).not.toHaveBeenCalled();
    });

    it("asks for a different card when the bank refuses the charge on a card saved for this purchase", async () => {
      const reset = vi.fn();
      const refreshPaymentMethods = vi.fn().mockResolvedValue(undefined);
      const analyticsService = mock<AnalyticsService>();
      const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(addPaymentMethod);
      setup({
        status: "success",
        clientSecret: "seti_secret",
        reset,
        refreshPaymentMethods,
        analyticsService,
        confirmPayment: vi.fn().mockRejectedValue({ response: { status: 402, data: { code: "card_declined" } } }),
        dependencies: { AddCreditsNewPaymentMethodFields }
      });
      act(() => lastProps()!.onPaymentTypeChange?.("link"));

      await submitWithAmount("100");

      expect(refreshPaymentMethods).toHaveBeenCalled();
      expect(reset).toHaveBeenCalledOnce();
      expect(lastProps()!.disabled).toBe(false);
      expect(screen.queryByRole("button", { name: "Use a different payment method" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(BANK_REFUSED_MESSAGE);

      await submitWithAmount("100");

      expect(addPaymentMethod).toHaveBeenCalledTimes(2);
      const submittedTypes = analyticsService.track.mock.calls
        .filter(([event]) => event === "add_credits_payment_submitted")
        .map(([, properties]) => (properties as { type?: string }).type);
      expect(submittedTypes).toEqual(["link", "card"]);
    });

    it("starts a fresh new card form once the bank refuses a new card twice in a row", async () => {
      const reset = vi.fn();
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(vi.fn().mockResolvedValue(BANK_REFUSAL));
      setup({ status: "success", clientSecret: "seti_secret", reset, dependencies: { AddCreditsNewPaymentMethodFields } });

      await submitWithAmount("100");

      expect(reset).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      await submitWithAmount("100");

      expect(reset).toHaveBeenCalledOnce();
      expect(screen.getByRole("alert")).toHaveTextContent(BANK_REFUSED_MESSAGE);

      await submitWithAmount("100");

      expect(reset).toHaveBeenCalledOnce();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps the new card form when another setup failure breaks the run of refusals", async () => {
      const reset = vi.fn();
      const addPaymentMethod = vi
        .fn()
        .mockResolvedValueOnce(BANK_REFUSAL)
        .mockResolvedValueOnce({ failure: { errorType: "validation_error", errorCode: "incomplete_number" } })
        .mockResolvedValueOnce(BANK_REFUSAL);
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);
      setup({ status: "success", clientSecret: "seti_secret", reset, dependencies: { AddCreditsNewPaymentMethodFields } });

      await submitWithAmount("100");
      await submitWithAmount("100");
      await submitWithAmount("100");

      expect(addPaymentMethod).toHaveBeenCalledTimes(3);
      expect(reset).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("leaves the selected method alone when the bank refuses a wallet", async () => {
      const reset = vi.fn();
      const addPaymentMethod = vi.fn().mockResolvedValue(BANK_REFUSAL);
      const AddCreditsWalletButton: typeof DEPENDENCIES.AddCreditsWalletButton = ({ onSubmit }) => (
        <button type="button" onClick={() => void onSubmit({ type: "google_pay", addPaymentMethod })}>
          Express checkout
        </button>
      );
      setup({ status: "idle", reset, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })], dependencies: { AddCreditsWalletButton } });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));

      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Express checkout" })));
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Express checkout" })));

      expect(addPaymentMethod).toHaveBeenCalledTimes(2);
      expect(reset).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /4242/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("payment form readiness", () => {
    it("tracks the payment form as ready once, with how long it took since the form opened", () => {
      let clock = 1000.4;
      vi.spyOn(performance, "now").mockImplementation(() => clock);
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, context: "billing", dependencies: { AddCreditsNewPaymentMethodFields } });

      clock = 3500.6;
      act(() => lastProps()!.onReady?.());
      act(() => lastProps()!.onReady?.());

      const readyEvents = analyticsService.track.mock.calls.filter(([event]) => event === "add_credits_payment_form_ready");
      expect(readyEvents).toEqual([["add_credits_payment_form_ready", { category: "billing", type: "card", msSinceOpen: 2500, context: "billing" }]]);
    });

    it("tracks the payment type the payment element reported before it was ready", () => {
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });

      act(() => lastProps()!.onPaymentTypeChange?.("link"));
      act(() => lastProps()!.onReady?.());

      expect(analyticsService.track).toHaveBeenCalledWith("add_credits_payment_form_ready", expect.objectContaining({ type: "link" }));
    });
  });

  describe("payment form loading", () => {
    it("keeps Purchase disabled as 'Loading card form…' until the card form is ready", () => {
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", dependencies: { AddCreditsNewPaymentMethodFields } });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));
      const fields = screen.getByTestId("new-payment-method-fields");

      expect(screen.getByRole("button", { name: "Loading card form…" })).toBeDisabled();
      act(() => lastProps()!.onReady?.());

      expect(screen.getByRole("button", { name: "Purchase Credits" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Loading card form…" })).not.toBeInTheDocument();
      expect(screen.getByTestId("new-payment-method-fields")).toBe(fields);
    });

    it("lets a saved payment method pay without waiting for the card form", () => {
      const analyticsService = mock<AnalyticsService>();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      setup({ status: "idle", analyticsService, paymentMethods: [paymentMethod({ isDefault: true })] });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));

      act(() => vi.advanceTimersByTime(10_000));

      expect(screen.getByRole("button", { name: "Purchase Credits" })).toBeEnabled();
      expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_payment_form_load_failed", expect.anything());
    });

    it("shows the card form as failed with Retry after 10 seconds without a ready form, and tracks it once", () => {
      let clock = 1000.4;
      vi.spyOn(performance, "now").mockImplementation(() => clock);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, context: "billing", dependencies: { AddCreditsNewPaymentMethodFields } });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));

      act(() => vi.advanceTimersByTime(9_999));
      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      clock = 11_250.6;
      act(() => vi.advanceTimersByTime(1));
      act(() => vi.advanceTimersByTime(10_000));

      expect(screen.getByRole("alert")).toHaveTextContent("The card form didn't load");
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(screen.queryByTestId("new-payment-method-fields")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Purchase Credits" })).toBeDisabled();
      expect(loadFailedEvents(analyticsService)).toEqual([
        ["add_credits_payment_form_load_failed", { category: "billing", reason: "timeout", msSinceOpen: 10_250, context: "billing" }]
      ]);
    });

    it.each(["stripe_unavailable", "load_error"] as const)("shows the card form as failed when it reports %s", reason => {
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });

      act(() => lastProps()!.onLoadFailed(reason));

      expect(screen.getByRole("alert")).toHaveTextContent("The card form didn't load");
      expect(loadFailedEvents(analyticsService)).toEqual([["add_credits_payment_form_load_failed", expect.objectContaining({ reason })]]);
    });

    it("does not time out a card form that is ready", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const analyticsService = mock<AnalyticsService>();
      setup({ status: "success", clientSecret: "seti_secret", analyticsService });

      act(() => vi.advanceTimersByTime(10_000));

      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      expect(loadFailedEvents(analyticsService)).toEqual([]);
    });

    it("leaves a failed setup intent to its own retry instead of timing out", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const analyticsService = mock<AnalyticsService>();
      setup({ status: "error", analyticsService });

      act(() => vi.advanceTimersByTime(10_000));

      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load the payment form/i);
      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      expect(loadFailedEvents(analyticsService)).toEqual([]);
    });

    it("shows only the card form failure when the setup intent failed as well", () => {
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "error", dependencies: { AddCreditsNewPaymentMethodFields } });

      act(() => lastProps()!.onLoadFailed("stripe_unavailable"));

      expect(screen.getByRole("alert")).toHaveTextContent("The card form didn't load");
      expect(screen.queryByText(/couldn't load the payment form/i)).not.toBeInTheDocument();
    });

    it("retries with a fresh setup intent and card form, and times out again if that one stalls too", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const reset = vi.fn();
      const analyticsService = mock<AnalyticsService>();
      const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", reset, analyticsService, dependencies: { AddCreditsNewPaymentMethodFields } });
      act(() => vi.advanceTimersByTime(10_000));

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(reset).toHaveBeenCalledOnce();
      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      expect(screen.getByTestId("new-payment-method-fields")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Loading card form…" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(10_000));
      expect(screen.getByRole("alert")).toHaveTextContent("The card form didn't load");
      expect(loadFailedEvents(analyticsService)).toHaveLength(2);
    });

    it("hides a failed card form once a saved method is picked and loads it afresh when the user comes back", () => {
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", paymentMethods: [paymentMethod()], dependencies: { AddCreditsNewPaymentMethodFields } });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));
      fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
      act(() => lastProps()!.onLoadFailed("load_error"));

      fireEvent.click(screen.getByRole("button", { name: /4242/ }));

      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Purchase Credits" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
      expect(screen.queryByText("The card form didn't load")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Loading card form…" })).toBeDisabled();
    });

    it("waits for the card form again when the user comes back to a new card after it was ready", () => {
      const { Mock: AddCreditsNewPaymentMethodFields, lastProps } = makePaymentMethodFieldsMock(undefined, { reportsReady: false });
      setup({ status: "success", clientSecret: "seti_secret", paymentMethods: [paymentMethod()], dependencies: { AddCreditsNewPaymentMethodFields } });
      fireEvent.click(screen.getByRole("radio", { name: "100" }));
      fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));
      act(() => lastProps()!.onReady?.());
      fireEvent.click(screen.getByRole("button", { name: /4242/ }));

      fireEvent.click(screen.getByRole("button", { name: /add new payment method/i }));

      expect(screen.getByRole("button", { name: "Loading card form…" })).toBeDisabled();
    });

    function loadFailedEvents(analyticsService: AnalyticsService) {
      return vi.mocked(analyticsService.track).mock.calls.filter(([event]) => event === "add_credits_payment_form_load_failed");
    }
  });

  async function purchaseUntilPollingSettles(overrides: Partial<SetupInput>) {
    const onDone = vi.fn();
    const input: SetupInput = { status: "idle", onDone, paymentMethods: [paymentMethod({ id: "pm_saved", isDefault: true })], ...overrides };
    const { rerender } = setup(input);

    await submitWithAmount("100");
    rerender({ ...input, isPolling: true });
    rerender({ ...input, isPolling: false });

    return { onDone };
  }

  function transaction(overrides: Partial<BillingTransaction>): BillingTransaction {
    return { id: "tx_1", type: "payment_intent", amount: 10000, amountRefunded: 0, currency: "usd", status: "succeeded", created: 0, ...overrides };
  }

  async function submitWithAmount(amount: string) {
    fireEvent.click(screen.getByRole("radio", { name: amount }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });
  }

  function capture3DSecure() {
    let options: Parameters<typeof DEPENDENCIES.use3DSecure>[0] | undefined;
    const use3DSecure: typeof DEPENDENCIES.use3DSecure = input => {
      options = input;
      return mock<ReturnType<typeof DEPENDENCIES.use3DSecure>>({
        isOpen: false,
        threeDSData: null,
        isLoading: false,
        start3DSecure: vi.fn(),
        close3DSecure: vi.fn(),
        handle3DSSuccess: vi.fn(),
        handle3DSError: vi.fn()
      });
    };
    return { use3DSecure, threeDSecureOptions: () => options };
  }

  function makePaymentMethodFieldsMock(
    addPaymentMethod: PaymentMethodSourceHandle["addPaymentMethod"] = vi.fn().mockResolvedValue({ failure: {} }),
    options: { reportsReady?: boolean } = {}
  ) {
    type FieldsProps = {
      clientSecret?: string;
      isLoading: boolean;
      disabled?: boolean;
      onPaymentTypeChange?: (type: string) => void;
      onReady?: () => void;
      onLoadFailed: (error: PaymentFormLoadError) => void;
    };
    const { reportsReady = true } = options;
    const propsLog: FieldsProps[] = [];
    const Mock: typeof DEPENDENCIES.AddCreditsNewPaymentMethodFields = React.forwardRef<PaymentMethodSourceHandle, FieldsProps>(
      function MockPaymentMethodFields(props, ref) {
        const { clientSecret, onReady } = props;
        propsLog.push(props);
        useImperativeHandle(ref, () => ({ addPaymentMethod }), [addPaymentMethod]);
        useEffect(() => {
          if (reportsReady && clientSecret) onReady?.();
        }, [clientSecret, onReady]);
        return <div data-testid="new-payment-method-fields" />;
      }
    );

    return {
      Mock,
      lastProps: () => propsLog.at(-1)
    };
  }

  const MockSelectContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

  const MockSelect: typeof DEPENDENCIES.Select = ({ children, value, onValueChange }) => (
    <MockSelectContext.Provider value={{ value, onValueChange }}>{children}</MockSelectContext.Provider>
  );
  const MockSelectTrigger = React.forwardRef<HTMLButtonElement, { children?: React.ReactNode }>(function MockSelectTrigger({ children }) {
    return <div>{children}</div>;
  });
  const MockSelectValue = React.forwardRef<HTMLSpanElement, object>(function MockSelectValue() {
    return null;
  });
  const MockSelectContent = React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(function MockSelectContent({ children }) {
    return <div>{children}</div>;
  });
  const MockSelectItem = React.forwardRef<HTMLDivElement, { children?: React.ReactNode; value: string }>(function MockSelectItem({ children, value }) {
    const { value: selected, onValueChange } = useContext(MockSelectContext);
    return (
      <button type="button" aria-pressed={selected === value} onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  });
  const MockLabel = React.forwardRef<HTMLLabelElement, { children?: React.ReactNode }>(function MockLabel({ children }) {
    return <span>{children}</span>;
  });

  function paymentMethod(overrides?: Partial<PaymentMethod>): PaymentMethod {
    return {
      id: "pm_1",
      type: "card",
      created: 0,
      validated: true,
      isDefault: false,
      card: { brand: "visa", last4: "4242", funding: "credit", exp_month: 12, exp_year: 2030 },
      ...overrides
    };
  }

  function setup(input: SetupInput) {
    const result = render(buildElement(input));
    return {
      ...result,
      rerender(next: SetupInput) {
        result.rerender(buildElement({ ...next, dependencies: { ...input.dependencies, ...next.dependencies } }));
      }
    };
  }

  type SetupInput = {
    status: ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>["status"];
    clientSecret?: string;
    mutate?: ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>["mutate"];
    reset?: ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>["reset"];
    refreshPaymentMethods?: ReturnType<typeof DEPENDENCIES.useRefreshPaymentMethods>;
    getCustomerTransactions?: ReturnType<typeof DEPENDENCIES.useServices>["stripe"]["getCustomerTransactions"];
    invalidateQueries?: QueryClient["invalidateQueries"];
    topUpMinAmountUsd?: number;
    confirmPayment?: ReturnType<typeof DEPENDENCIES.usePaymentMutations>["confirmPayment"]["mutateAsync"];
    pollForPayment?: ReturnType<typeof DEPENDENCIES.usePaymentPolling>["pollForPayment"];
    start3DSecure?: ReturnType<typeof DEPENDENCIES.use3DSecure>["start3DSecure"];
    handleStripeError?: typeof DEPENDENCIES.handleStripeError;
    onDone?: (amount: number, bonusAmount?: number) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    context?: string;
    deploymentDailyCostUsd?: number;
    isTrialing?: boolean;
    isPolling?: boolean;
    lastOutcome?: ReturnType<typeof DEPENDENCIES.usePaymentPolling>["lastOutcome"];
    walletBalanceUsd?: number;
    paymentMethods?: PaymentMethod[];
    isLoadingMethods?: boolean;
    isMethodsError?: boolean;
    analyticsService?: AnalyticsService;
    dependencies?: Partial<typeof DEPENDENCIES>;
  };

  function buildElement(input: SetupInput) {
    const useSetupIntentMutation: typeof DEPENDENCIES.useSetupIntentMutation = () =>
      ({
        data: input.clientSecret ? { clientSecret: input.clientSecret } : undefined,
        mutate: input.mutate ?? vi.fn(),
        reset: input.reset ?? vi.fn(),
        status: input.status
      }) as unknown as ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>;

    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: { userId: "user_1", id: "user_1" } as ReturnType<typeof DEPENDENCIES.useUser>["user"]
      });

    const usePaymentMutations: typeof DEPENDENCIES.usePaymentMutations = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePaymentMutations>>({
        confirmPayment: mock<ReturnType<typeof DEPENDENCIES.usePaymentMutations>["confirmPayment"]>({
          mutateAsync: input.confirmPayment ?? vi.fn()
        })
      });

    const usePaymentPolling: typeof DEPENDENCIES.usePaymentPolling = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePaymentPolling>>({
        pollForPayment: input.pollForPayment ?? vi.fn(),
        stopPolling: vi.fn(),
        isPolling: input.isPolling ?? false,
        lastOutcome: input.lastOutcome === undefined ? "success" : input.lastOutcome
      });

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false, topUpMinAmountUsd: input.topUpMinAmountUsd ?? 20 });

    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        balance: input.walletBalanceUsd != null ? mock<WalletBalance>({ totalUsd: input.walletBalanceUsd }) : null
      });

    const refreshPaymentMethods = input.refreshPaymentMethods ?? vi.fn().mockResolvedValue(undefined);
    const useRefreshPaymentMethods: typeof DEPENDENCIES.useRefreshPaymentMethods = () => refreshPaymentMethods;

    const api = createProxy({ v1: { getFirstPurchaseBonus: vi.fn(), listStripeTransactions: vi.fn() } }) as unknown as ReturnType<
      typeof DEPENDENCIES.useServices
    >["api"];
    const services = mock<ReturnType<typeof DEPENDENCIES.useServices>>({
      stripe: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripe"]>({
        getCustomerTransactions: input.getCustomerTransactions ?? vi.fn().mockResolvedValue({ transactions: [] })
      }),
      analyticsService: input.analyticsService ?? mock<AnalyticsService>(),
      queryClient: mock<QueryClient>({ invalidateQueries: input.invalidateQueries ?? vi.fn() })
    });
    services.api = api;
    const useServices: typeof DEPENDENCIES.useServices = () => services;

    // UseQueryResult is a discriminated union that neither mock<T>() nor a partial literal can satisfy
    const usePaymentMethodsQuery = (() => ({
      data: input.isMethodsError ? undefined : input.paymentMethods ?? [],
      isLoading: input.isLoadingMethods ?? false,
      isError: input.isMethodsError ?? false
    })) as unknown as typeof DEPENDENCIES.usePaymentMethodsQuery;

    const use3DSecure: typeof DEPENDENCIES.use3DSecure = () =>
      mock<ReturnType<typeof DEPENDENCIES.use3DSecure>>({
        isOpen: false,
        threeDSData: null,
        isLoading: false,
        start3DSecure: input.start3DSecure ?? vi.fn(),
        close3DSecure: vi.fn(),
        handle3DSSuccess: vi.fn(),
        handle3DSError: vi.fn()
      });

    return (
      <AddCreditsForm
        onDone={input.onDone ?? vi.fn()}
        onProcessingChange={input.onProcessingChange}
        context={input.context}
        deploymentDailyCostUsd={input.deploymentDailyCostUsd}
        dependencies={{
          AddCreditsAmountFields,
          AddCreditsNewPaymentMethodFields: makePaymentMethodFieldsMock().Mock,
          AddCreditsWalletButton: () => null,
          FirstPurchaseBonusAlert: ({ amount }) => <div data-testid="first-purchase-bonus-alert">{amount}</div>,
          ThreeDSecurePopup: () => null,
          Label: MockLabel,
          Select: MockSelect,
          SelectContent: MockSelectContent,
          SelectItem: MockSelectItem,
          SelectTrigger: MockSelectTrigger,
          SelectValue: MockSelectValue,
          Skeleton: () => <div data-testid="skeleton" />,
          useSetupIntentMutation,
          useUser,
          usePaymentMethodsQuery,
          usePaymentMutations,
          usePaymentPolling,
          useRefreshPaymentMethods,
          useServices,
          useWallet,
          useWalletBalance,
          use3DSecure,
          useTopUpAttemptKey,
          getPaymentMethodDisplay,
          handleStripeError: input.handleStripeError ?? (() => ({ message: "fallback", userAction: undefined })),
          waitForSettledTransaction: vi.fn().mockResolvedValue(undefined),
          ...input.dependencies
        }}
      />
    );
  }
});
