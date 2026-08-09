import { describe, expect, it } from "vitest";

import { autoTopUpSucceededNotification } from "./auto-top-up-succeeded-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(autoTopUpSucceededNotification.name, () => {
  it("returns a notification with the charged amount, resulting balance and billing link", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = autoTopUpSucceededNotification(user, {
      transactionId: "txn-1",
      amountCents: 5000,
      balanceUsd: 120.5,
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.notificationId).toBe("autoTopUpSucceeded.txn-1");
    expect(result.payload.summary).toBe("Your Akash account was topped up $50.00");
    expect(result.payload.description).toContain("$50.00");
    expect(result.payload.description).toContain("<strong>$120.50</strong>");
    expect(result.payload.description).toContain('<a href="https://console.akash.network/billing">');
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });
});
