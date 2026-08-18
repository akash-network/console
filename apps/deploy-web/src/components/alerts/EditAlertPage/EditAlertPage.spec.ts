import { describe, expect, it } from "vitest";

import { getWalletBalanceAlertInitialValues } from "./EditAlertPage";

import { buildWalletBalanceAlert } from "@tests/seeders/alert";

describe("getWalletBalanceAlertInitialValues", () => {
  it("converts a simple balance condition to display units in the alert denom", () => {
    const alert = buildWalletBalanceAlert({
      name: "Low balance",
      notificationChannelId: "channel-1",
      enabled: true,
      params: { owner: "akash1owner", denom: "uakt" },
      conditions: { operator: "lt", field: "balance", value: 5_000_000 }
    });

    expect(getWalletBalanceAlertInitialValues(alert)).toEqual({
      name: "Low balance",
      notificationChannelId: "channel-1",
      enabled: true,
      operator: "lt",
      amount: 5
    });
  });

  it("uses the first leaf of a compound condition", () => {
    const alert = buildWalletBalanceAlert({
      params: { owner: "akash1owner", denom: "uakt" },
      conditions: {
        operator: "or",
        value: [
          { operator: "gte", field: "balance", value: 2_000_000 },
          { operator: "lt", field: "balance", value: 500_000 }
        ]
      }
    });

    const result = getWalletBalanceAlertInitialValues(alert);

    expect(result.operator).toBe("gte");
    expect(result.amount).toBe(2);
  });
});
