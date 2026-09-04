import { describe, expect, it } from "vitest";

import { creditsRunningLowNotification } from "./credits-running-low-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(creditsRunningLowNotification.name, () => {
  it("returns a notification with balance, coverage, payment and billing links", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsRunningLowNotification(user, {
      balanceUsd: 12.5,
      weeklyCostUsd: 35,
      daysRemaining: 2,
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.notificationId).toBe("creditsRunningLow.user-123");
    expect(result.payload.summary).toBe("Your Akash credits are running low");
    expect(result.payload.description).toContain("<strong>$12.50</strong>");
    expect(result.payload.description).toContain("about 2 days of current usage");
    expect(result.payload.actions).toEqual([
      { label: "Add credits", url: "https://console.akash.network/billing?openPayment=true" },
      { label: "Enable Auto Recharge", url: "https://console.akash.network/billing" }
    ]);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("says less than a day when days remaining is below 1", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsRunningLowNotification(user, {
      balanceUsd: 1,
      weeklyCostUsd: 70,
      daysRemaining: 0,
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.description).toContain("about less than a day of current usage");
  });

  it("uses singular day when days remaining is 1", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsRunningLowNotification(user, {
      balanceUsd: 10,
      weeklyCostUsd: 70,
      daysRemaining: 1,
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.description).toContain("about 1 day of current usage");
    expect(result.payload.description).not.toContain("1 days");
  });
});
