import React, { useContext, useImperativeHandle } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { QueryKeys } from "@src/queries";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AddCreditsAmountFields } from "../AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentMethodSourceHandle } from "../AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import type { DEPENDENCIES } from "./AddCreditsForm";
import { AddCreditsForm } from "./AddCreditsForm";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(AddCreditsForm.name, () => {
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

  it("renders the first-purchase bonus alert with the entered amount regardless of trial state", () => {
    setup({ status: "idle" });

    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    expect(screen.getByTestId("first-purchase-bonus-alert")).toHaveTextContent("100");
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
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_saved", amount: 100 });
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
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
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
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1", amount: 100 });
    expect(pollForPayment).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onDone after polling stops and the user is no longer trialing", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
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

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, "Acme", 0));
  });

  it("passes the granted first-purchase bonus to onDone", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
    const getCustomerTransactions = vi.fn().mockResolvedValue({ transactions: [{ status: "succeeded", amount: 10000, bonusAmount: 1000 }] });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      getCustomerTransactions,
      isTrialing: true,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: true, isPolling: true });
    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: false, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, "Acme", 10));
    expect(getCustomerTransactions).toHaveBeenCalledWith({ limit: 1 });
  });

  it("reports a zero bonus when the latest transaction does not match the charge", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
    const getCustomerTransactions = vi.fn().mockResolvedValue({ transactions: [{ status: "succeeded", amount: 5000, bonusAmount: 1000 }] });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      getCustomerTransactions,
      isTrialing: true,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: true, isPolling: true });
    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: false, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, "Acme", 0));
  });

  it("completes with a zero bonus when the transaction lookup fails", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
    const getCustomerTransactions = vi.fn().mockRejectedValue(new Error("boom"));
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      onDone,
      getCustomerTransactions,
      isTrialing: true,
      isPolling: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: true, isPolling: true });
    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, getCustomerTransactions, isTrialing: false, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, "Acme", 0));
  });

  it("shows an error when polling stops without the trial flipping", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
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

  it("defers confirmPayment until the wallet is ready", async () => {
    const confirmPayment = vi.fn().mockResolvedValue({ success: true });
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_1", organization: "Acme" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    const { rerender } = setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      isWalletReady: false,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, isWalletReady: true });
    });

    await waitFor(() => expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1", amount: 100 }));
  });

  it("does not call the API when addPaymentMethod resolves null", async () => {
    const confirmPayment = vi.fn();
    const onDone = vi.fn();
    const addPaymentMethod = vi.fn().mockResolvedValue(null);
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

    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_saved", amount: 50 });
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
    expect(confirmPayment).toHaveBeenLastCalledWith({ userId: "user_1", paymentMethodId: "pm_new", amount: 100 });
  });

  it("invalidates the payment methods query when a new-card charge fails", async () => {
    const invalidateQueries = vi.fn();
    const confirmPayment = vi.fn().mockRejectedValue(new Error("declined"));
    const addPaymentMethod = vi.fn().mockResolvedValue({ paymentMethodId: "pm_new" });
    const { Mock: AddCreditsNewPaymentMethodFields } = makePaymentMethodFieldsMock(addPaymentMethod);

    setup({
      status: "success",
      clientSecret: "seti_secret",
      confirmPayment,
      invalidateQueries,
      dependencies: { AddCreditsNewPaymentMethodFields }
    });

    fireEvent.click(screen.getByRole("radio", { name: "100" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getPaymentMethodsKey() });
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

  function makePaymentMethodFieldsMock(addPaymentMethod: PaymentMethodSourceHandle["addPaymentMethod"] = vi.fn().mockResolvedValue(null)) {
    const propsLog: Array<{ clientSecret?: string; isLoading: boolean }> = [];
    const Mock: typeof DEPENDENCIES.AddCreditsNewPaymentMethodFields = React.forwardRef<
      PaymentMethodSourceHandle,
      { clientSecret?: string; isLoading: boolean }
    >(function MockPaymentMethodFields(props, ref) {
      propsLog.push(props);
      useImperativeHandle(ref, () => ({ addPaymentMethod }), [addPaymentMethod]);
      return <div data-testid="new-payment-method-fields" />;
    });

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
    invalidateQueries?: ReturnType<typeof DEPENDENCIES.useQueryClient>["invalidateQueries"];
    getCustomerTransactions?: ReturnType<typeof DEPENDENCIES.useServices>["stripe"]["getCustomerTransactions"];
    topUpMinAmountUsd?: number;
    confirmPayment?: ReturnType<typeof DEPENDENCIES.usePaymentMutations>["confirmPayment"]["mutateAsync"];
    pollForPayment?: ReturnType<typeof DEPENDENCIES.usePaymentPolling>["pollForPayment"];
    start3DSecure?: ReturnType<typeof DEPENDENCIES.use3DSecure>["start3DSecure"];
    handleStripeError?: typeof DEPENDENCIES.handleStripeError;
    onDone?: (amount: number, organization?: string) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    isTrialing?: boolean;
    isPolling?: boolean;
    isWalletReady?: boolean;
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
        isPolling: input.isPolling ?? false
      });

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false, topUpMinAmountUsd: input.topUpMinAmountUsd ?? 20 });

    const useQueryClient: typeof DEPENDENCIES.useQueryClient = () =>
      mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>({
        invalidateQueries: input.invalidateQueries ?? vi.fn()
      });

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        stripe: mock<ReturnType<typeof DEPENDENCIES.useServices>["stripe"]>({
          getCustomerTransactions: input.getCustomerTransactions ?? vi.fn().mockResolvedValue({ transactions: [] })
        }),
        analyticsService: input.analyticsService ?? mock<AnalyticsService>()
      });

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
        isWalletReady={input.isWalletReady ?? true}
        onProcessingChange={input.onProcessingChange}
        dependencies={{
          AddCreditsAmountFields,
          AddCreditsNewPaymentMethodFields: makePaymentMethodFieldsMock().Mock,
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
          useQueryClient,
          useServices,
          useWallet,
          use3DSecure,
          getPaymentMethodDisplay,
          handleStripeError: input.handleStripeError ?? (() => ({ message: "fallback", userAction: undefined })),
          ...input.dependencies
        }}
      />
    );
  }
});
