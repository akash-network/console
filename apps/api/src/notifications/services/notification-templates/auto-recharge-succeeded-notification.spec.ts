import { describe, expect, it } from "vitest";

import { autoRechargeSucceededNotification } from "./auto-recharge-succeeded-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(autoRechargeSucceededNotification.name, () => {
  it("returns a notification with the charged amount, resulting balance and billing link", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = autoRechargeSucceededNotification(user, {
      transactionId: "txn-1",
      amountCents: 5000,
      balanceUsd: 120.5,
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.notificationId).toBe("autoRechargeSucceeded.txn-1");
    expect(result.payload.summary).toBe("Your Akash account was recharged $50.00");
    expect(result.payload.description).toContain("$50.00");
    expect(result.payload.description).toContain("<strong>$120.50</strong>");
    expect(result.payload.actions).toEqual([{ label: "View billing", url: "https://console.akash.network/billing" }]);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });
});
