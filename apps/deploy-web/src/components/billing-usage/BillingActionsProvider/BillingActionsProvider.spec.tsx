import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { BillingActionsProvider, type DEPENDENCIES, useBillingActions } from "./BillingActionsProvider";

import { act, fireEvent, render, screen } from "@testing-library/react";

const Consumer = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { openAddPaymentMethod } = useBillingActions();
  return (
    <>
      <button type="button" onClick={() => openAddPaymentMethod({ onSuccess })}>
        open
      </button>
      <button type="button" onClick={() => openAddPaymentMethod()}>
        open plain
      </button>
    </>
  );
};

const MockPopup = ({ open, onClose, clientSecret, isDarkMode, onSuccess }: any) =>
  open ? (
    <div data-testid="popup">
      <span data-testid="secret">{clientSecret}</span>
      <span data-testid="dark">{isDarkMode ? "dark" : "light"}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
      <button type="button" onClick={onSuccess}>
        success
      </button>
    </div>
  ) : null;

describe("BillingActionsProvider", () => {
  it("creates a setup intent and opens the popup when the add flow is triggered", () => {
    const { createSetupIntent, resetSetupIntent } = setup();

    fireEvent.click(screen.getByText("open"));

    expect(resetSetupIntent).toHaveBeenCalled();
    expect(createSetupIntent).toHaveBeenCalled();
    expect(screen.getByTestId("popup")).toBeInTheDocument();
  });

  it("passes the setup-intent client secret and dark mode to the popup", () => {
    setup({ setupIntent: { clientSecret: "cs_123" }, theme: "dark" });

    fireEvent.click(screen.getByText("open"));

    expect(screen.getByTestId("secret")).toHaveTextContent("cs_123");
    expect(screen.getByTestId("dark")).toHaveTextContent("dark");
  });

  it("closes the popup and refreshes payment methods on success", async () => {
    const { refresh } = setup();

    fireEvent.click(screen.getByText("open"));
    await act(async () => {
      fireEvent.click(screen.getByText("success"));
    });

    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });

  it("closes the popup when the popup requests it", () => {
    setup();

    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("close"));

    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });

  it("runs the caller's success callback once the card is saved", async () => {
    const onSuccess = vi.fn();
    setup({ onSuccess });

    fireEvent.click(screen.getByText("open"));
    await act(async () => {
      fireEvent.click(screen.getByText("success"));
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not carry a cancelled call's success callback into a later unrelated card", async () => {
    const onSuccess = vi.fn();
    setup({ onSuccess });

    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("close"));

    fireEvent.click(screen.getByText("open plain"));
    await act(async () => {
      fireEvent.click(screen.getByText("success"));
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("keeps the popup closed and toasts when creating the setup intent fails", () => {
    const { toast } = setup({ isError: true });

    fireEvent.click(screen.getByText("open"));

    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  function setup(input: { setupIntent?: { clientSecret: string }; theme?: string; isError?: boolean; onSuccess?: () => void } = {}) {
    const createSetupIntent = vi.fn();
    const resetSetupIntent = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();

    const setupIntentMutation = input.isError
      ? mock<ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>>({ mutate: createSetupIntent, reset: resetSetupIntent, isError: true, data: undefined })
      : mock<ReturnType<typeof DEPENDENCIES.useSetupIntentMutation>>({
          mutate: createSetupIntent,
          reset: resetSetupIntent,
          isError: false,
          data: input.setupIntent
        });

    const dependencies: typeof DEPENDENCIES = {
      useTheme: () => mock<ReturnType<typeof DEPENDENCIES.useTheme>>({ resolvedTheme: input.theme ?? "light" }),
      useToast: () => mock<ReturnType<typeof DEPENDENCIES.useToast>>({ toast }),
      useSetupIntentMutation: () => setupIntentMutation,
      useRefreshPaymentMethods: () => refresh,
      AddPaymentMethodPopup: MockPopup
    };

    render(
      <BillingActionsProvider dependencies={dependencies}>
        <Consumer onSuccess={input.onSuccess} />
      </BillingActionsProvider>
    );

    return { createSetupIntent, resetSetupIntent, refresh, toast };
  }
});
