import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalanceAlertFormProps } from "./WalletBalanceAlertForm";
import { WalletBalanceAlertForm } from "./WalletBalanceAlertForm";

import { fireEvent, render, screen } from "@testing-library/react";

describe(WalletBalanceAlertForm.name, () => {
  it("renders the watched wallet and denom as read-only", () => {
    setup({ owner: "akash1owner", denom: "uakt" });

    expect(screen.getByTestId("wallet-balance-alert-owner")).toHaveTextContent("akash1owner");
    expect(screen.getByText("uakt")).toBeInTheDocument();
  });

  it("prefills the form from initial values", () => {
    setup({ initialValues: { name: "Low balance", notificationChannelId: "channel-1", operator: "lt", amount: 5, enabled: true } });

    expect(screen.getByTestId("wallet-balance-alert-name")).toHaveValue("Low balance");
    expect(screen.getByTestId("wallet-balance-alert-amount")).toHaveValue(5);
  });

  it("shows the base-unit preview of the threshold in the alert denom", () => {
    setup({ denom: "uakt", initialValues: { name: "n", notificationChannelId: "c", operator: "lt", amount: 5, enabled: true } });

    expect(screen.getByTestId("wallet-balance-alert-base-preview")).toHaveTextContent("stored as 5,000,000 uakt");
  });

  it("updates the base-unit preview when the amount changes", () => {
    setup({ denom: "uakt", initialValues: { name: "n", notificationChannelId: "c", operator: "lt", amount: 5, enabled: true } });

    fireEvent.change(screen.getByTestId("wallet-balance-alert-amount"), { target: { value: "12.5" } });

    expect(screen.getByTestId("wallet-balance-alert-base-preview")).toHaveTextContent("stored as 12,500,000 uakt");
  });

  it("disables the submit button until a value changes", () => {
    setup();

    expect(screen.getByTestId("wallet-balance-alert-submit")).toBeDisabled();
  });

  it("submits the threshold converted to base units in the alert denom", async () => {
    const { onSubmit } = setup({
      denom: "uakt",
      initialValues: { name: "Low balance", notificationChannelId: "channel-1", operator: "lt", amount: 5, enabled: true }
    });

    fireEvent.change(screen.getByTestId("wallet-balance-alert-amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByTestId("wallet-balance-alert-submit"));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Low balance",
        notificationChannelId: "channel-1",
        enabled: true,
        conditions: { operator: "lt", field: "balance", value: 10_000_000 }
      });
    });
  });

  function setup(input: Partial<WalletBalanceAlertFormProps> = {}) {
    const onSubmit = vi.fn();
    const props: WalletBalanceAlertFormProps = {
      initialValues: { name: "Low balance", notificationChannelId: "channel-1", operator: "lt", amount: 5, enabled: true },
      owner: "akash1owner",
      denom: "uakt",
      onSubmit,
      ...input,
      dependencies: {
        NotificationChannelSelect: () => <div data-testid="notification-channel-select" />
      }
    };

    render(<WalletBalanceAlertForm {...props} />);

    return { onSubmit, props };
  }
});
