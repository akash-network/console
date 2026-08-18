import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalanceAlert } from "./EditAlertPage";
import { DEPENDENCIES, EditAlertPage, getWalletBalanceAlertInitialValues } from "./EditAlertPage";

import { render, screen } from "@testing-library/react";
import { buildWalletBalanceAlert } from "@tests/seeders/alert";
import { MockComponents } from "@tests/unit/mocks";

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
    const alert = buildWalletBalanceAlert({
      params: { owner: "akash1owner", denom: "uakt" },
      conditions: COMPOUND_CONDITION
    });

    expect(getWalletBalanceAlertInitialValues(alert)).toBeNull();
  });
});

describe(EditAlertPage.name, () => {
  it("renders the edit form for a single-threshold alert", () => {
    setup({ conditions: SINGLE_LEAF_CONDITION });

    expect(screen.getByTestId("edit-alert-container")).toBeInTheDocument();
    expect(screen.queryByTestId("compound-condition-notice")).not.toBeInTheDocument();
  });

  it("blocks editing and shows a notice for a compound-condition alert", () => {
    setup({ conditions: COMPOUND_CONDITION });

    expect(screen.getByTestId("compound-condition-notice")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-alert-container")).not.toBeInTheDocument();
  });

  function setup(overrides: Parameters<typeof buildWalletBalanceAlert>[0]) {
    const alert = buildWalletBalanceAlert(overrides);
    const dependencies = MockComponents(DEPENDENCIES, {
      useBackNav: () => vi.fn(),
      useNavigationGuard: () => ({ toggle: vi.fn() }),
      EditAlertContainer: () => <div data-testid="edit-alert-container" />
    });

    render(<EditAlertPage alert={alert} dependencies={dependencies} />);

    return { alert };
  }
});
