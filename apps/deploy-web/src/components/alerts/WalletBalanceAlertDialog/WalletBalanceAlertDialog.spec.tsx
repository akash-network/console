import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES, WalletBalanceAlert } from "./WalletBalanceAlertDialog";
import { getWalletBalanceAlertInitialValues, WalletBalanceAlertDialog } from "./WalletBalanceAlertDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildWalletBalanceAlert } from "@tests/seeders/alert";

const SINGLE_LEAF_CONDITION: WalletBalanceAlert["conditions"] = { operator: "lt", field: "balance", value: 5_000_000 };
const COMPOUND_CONDITION: WalletBalanceAlert["conditions"] = {
  operator: "or",
  value: [
    { operator: "gte", field: "balance", value: 2_000_000 },
    { operator: "lt", field: "balance", value: 500_000 }
  ]
};

describe(getWalletBalanceAlertInitialValues.name, () => {
  it("converts a simple balance condition to display units in the alert denom", () => {
    const alert = buildWalletBalanceAlert({
      name: "Low balance",
      notificationChannelId: "channel-1",
      enabled: true,
      params: { owner: "akash1owner", denom: "uakt" },
      conditions: SINGLE_LEAF_CONDITION
    });

    expect(getWalletBalanceAlertInitialValues(alert)).toEqual({
      name: "Low balance",
      notificationChannelId: "channel-1",
      enabled: true,
      operator: "lt",
      amount: 5
    });
  });

  it("returns null for a compound condition the single-threshold form cannot represent", () => {
    const alert = buildWalletBalanceAlert({ params: { owner: "akash1owner", denom: "uakt" }, conditions: COMPOUND_CONDITION });

    expect(getWalletBalanceAlertInitialValues(alert)).toBeNull();
  });
});

describe(WalletBalanceAlertDialog.name, () => {
  it("edits a single-threshold alert with its wallet and denom", () => {
    const { alert, WalletBalanceAlertForm, EditAlertContainer, onEdit, onClose } = setup({ conditions: SINGLE_LEAF_CONDITION });

    expect(screen.getByRole("dialog", { name: "Edit wallet balance alert" })).toBeInTheDocument();
    expect(EditAlertContainer.mock.lastCall![0]).toMatchObject({ id: alert.id, onEditSuccess: onClose });
    const formProps = WalletBalanceAlertForm.mock.lastCall![0];
    expect(formProps).toMatchObject({
      initialValues: { name: alert.name, operator: "lt", amount: 5 },
      owner: "akash1owner",
      denom: "uakt",
      isLoading: false,
      onCancel: onClose
    });

    const values = {
      name: "Low",
      notificationChannelId: "channel-1",
      enabled: true,
      conditions: { operator: "lt" as const, field: "balance" as const, value: 1 }
    };
    formProps.onSubmit(values);

    expect(onEdit).toHaveBeenCalledWith(values);
  });

  it("explains that a compound-condition alert can't be edited here", async () => {
    const { WalletBalanceAlertForm, EditAlertContainer, onClose } = setup({ conditions: COMPOUND_CONDITION });

    expect(screen.getByRole("dialog")).toHaveTextContent("This alert has several balance conditions, so it can't be edited here.");
    expect(EditAlertContainer).not.toHaveBeenCalled();
    expect(WalletBalanceAlertForm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes from its close button", async () => {
    const { onClose } = setup({ conditions: SINGLE_LEAF_CONDITION });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  function setup(input: { conditions: WalletBalanceAlert["conditions"] }) {
    const alert = buildWalletBalanceAlert({ conditions: input.conditions, params: { owner: "akash1owner", denom: "uakt" } });
    const onEdit = vi.fn();
    const onClose = vi.fn();
    const WalletBalanceAlertForm = vi.fn<typeof DEPENDENCIES.WalletBalanceAlertForm>(() => null);
    const EditAlertContainer = vi.fn<typeof DEPENDENCIES.EditAlertContainer>(({ children }) => <>{children({ onEdit, isLoading: false })}</>);

    render(<WalletBalanceAlertDialog alert={alert} onClose={onClose} dependencies={{ WalletBalanceAlertForm, EditAlertContainer }} />);

    return { alert, onEdit, onClose, WalletBalanceAlertForm, EditAlertContainer };
  }
});
