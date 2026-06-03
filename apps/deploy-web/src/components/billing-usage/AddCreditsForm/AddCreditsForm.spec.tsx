import React, { useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AddCreditsAmountFields } from "../AddCreditsAmountFields/AddCreditsAmountFields";
import type { PaymentMethodSourceHandle } from "../AddCreditsNewPaymentMethodFields/AddCreditsNewPaymentMethodFields";
import type { DEPENDENCIES } from "./AddCreditsForm";
import { AddCreditsForm } from "./AddCreditsForm";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

describe(AddCreditsForm.name, () => {
  it("creates a setup intent on mount", () => {
    const mutate = vi.fn();
    setup({ status: "idle", mutate });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("does not re-create the setup intent once it has been requested", () => {
    const mutate = vi.fn();
    setup({ status: "pending", mutate });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("renders the first-purchase match alert", () => {
    setup({ status: "idle" });

    expect(screen.getByText(/first-purchase match/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("radio", { name: /100/i }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1", amount: 100, currency: "usd" });
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

    fireEvent.click(screen.getByRole("radio", { name: /100/i }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: true, isPolling: true });
    expect(onDone).not.toHaveBeenCalled();

    rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, onDone, isTrialing: false, isPolling: false });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(100, "Acme"));
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

    fireEvent.click(screen.getByRole("radio", { name: /100/i }));

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

    fireEvent.click(screen.getByRole("radio", { name: /100/i }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(addPaymentMethod).toHaveBeenCalledTimes(1);
    expect(confirmPayment).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ status: "success", clientSecret: "seti_secret", confirmPayment, isWalletReady: true });
    });

    await waitFor(() => expect(confirmPayment).toHaveBeenCalledWith({ userId: "user_1", paymentMethodId: "pm_1", amount: 100, currency: "usd" }));
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

    fireEvent.click(screen.getByRole("radio", { name: "50" }));

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

    fireEvent.click(screen.getByRole("radio", { name: "50" }));

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

    fireEvent.click(screen.getByRole("radio", { name: "50" }));

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

    expect(screen.getByRole("button", { name: /purchase credits/i })).toBeDisabled();

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    await waitFor(() => expect(addPaymentMethod).not.toHaveBeenCalled());
    expect(confirmPayment).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("radio", { name: "50" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /purchase credits/i }).closest("form")!);
    });

    expect(onProcessingChange).toHaveBeenCalledWith(true);
  });

  function makePaymentMethodFieldsMock(addPaymentMethod: PaymentMethodSourceHandle["addPaymentMethod"] = vi.fn().mockResolvedValue(null)) {
    const propsLog: Array<{ clientSecret?: string; isLoading: boolean }> = [];
    const Mock: typeof DEPENDENCIES.AddCreditsNewPaymentMethodFields = React.forwardRef<
      PaymentMethodSourceHandle,
      { clientSecret?: string; isLoading: boolean }
    >(function MockPaymentMethodFields(props, ref) {
      propsLog.push(props);
      useImperativeHandle(ref, () => ({ addPaymentMethod }), [addPaymentMethod]);
      return null;
    });

    return {
      Mock,
      lastProps: () => propsLog.at(-1)
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
    confirmPayment?: ReturnType<typeof DEPENDENCIES.usePaymentMutations>["confirmPayment"]["mutateAsync"];
    pollForPayment?: ReturnType<typeof DEPENDENCIES.usePaymentPolling>["pollForPayment"];
    start3DSecure?: ReturnType<typeof DEPENDENCIES.use3DSecure>["start3DSecure"];
    handleStripeError?: typeof DEPENDENCIES.handleStripeError;
    onDone?: (amount: number, organization?: string) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    isTrialing?: boolean;
    isPolling?: boolean;
    isWalletReady?: boolean;
    initialBalance?: number | null;
    dependencies?: Partial<typeof DEPENDENCIES>;
  };

  function buildElement(input: SetupInput) {
    const useSetupIntentMutation: typeof DEPENDENCIES.useSetupIntentMutation = () =>
      ({
        data: input.clientSecret ? { clientSecret: input.clientSecret } : undefined,
        mutate: input.mutate ?? vi.fn(),
        reset: vi.fn(),
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

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });

    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        balance: input.initialBalance !== undefined ? ({ totalUsd: input.initialBalance } as ReturnType<typeof DEPENDENCIES.useWalletBalance>["balance"]) : null
      });

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
          ThreeDSecurePopup: () => null,
          useSetupIntentMutation,
          useUser,
          usePaymentMutations,
          usePaymentPolling,
          useWallet,
          useWalletBalance,
          use3DSecure,
          handleStripeError: input.handleStripeError ?? (() => ({ message: "fallback", userAction: undefined })),
          ...input.dependencies
        }}
      />
    );
  }
});
