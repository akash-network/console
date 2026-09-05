import { describe, expect, it } from "vitest";

import { autoTopUpAuthenticationRequiredNotification } from "./auto-top-up-authentication-required-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(autoTopUpAuthenticationRequiredNotification.name, () => {
  it("tells the user to pay by hand and links to the add funds modal", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = autoTopUpAuthenticationRequiredNotification(user, {
      pausedAt: new Date("2026-09-01T12:00:00.000Z"),
      paymentUrl: "https://console.akash.network/billing?openPayment=true"
    });

    expect(result.payload.summary).toBe("Auto top-up needs a card we can charge without you");
    expect(result.payload.description).toContain("confirm");
    expect(result.payload.actions).toEqual([{ label: "Add funds", url: "https://console.akash.network/billing?openPayment=true" }]);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("keys the notification on the pause so a later one is not swallowed as a duplicate", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const vars = { paymentUrl: "https://console.akash.network/billing?openPayment=true" };

    const first = autoTopUpAuthenticationRequiredNotification(user, { ...vars, pausedAt: new Date("2026-09-01T12:00:00.000Z") });
    const second = autoTopUpAuthenticationRequiredNotification(user, { ...vars, pausedAt: new Date("2026-09-20T08:30:00.000Z") });

    expect(first.notificationId).toBe("autoTopUpAuthenticationRequired.user-123.2026-09-01T12:00:00.000Z");
    expect(second.notificationId).not.toBe(first.notificationId);
  });
});
