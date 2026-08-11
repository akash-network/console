import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BillingActionsProvider, type DEPENDENCIES, useBillingActions } from "./BillingActionsProvider";

import { act, fireEvent, render, screen } from "@testing-library/react";

const Consumer = () => {
  const { openAddPaymentMethod } = useBillingActions();
  return (
    <button type="button" onClick={openAddPaymentMethod}>
      open
    </button>
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

  function setup(input: { setupIntent?: { clientSecret: string }; theme?: string } = {}) {
    const createSetupIntent = vi.fn();
    const resetSetupIntent = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);

    const dependencies = {
      useTheme: () => ({ resolvedTheme: input.theme ?? "light" }),
      useSetupIntentMutation: () => ({ data: input.setupIntent, mutate: createSetupIntent, reset: resetSetupIntent }),
      useRefreshPaymentMethods: () => refresh,
      AddPaymentMethodPopup: MockPopup
    } as unknown as typeof DEPENDENCIES;

    render(
      <BillingActionsProvider dependencies={dependencies}>
        <Consumer />
      </BillingActionsProvider>
    );

    return { createSetupIntent, resetSetupIntent, refresh };
  }
});
