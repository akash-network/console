import { describe, expect, it } from "vitest";

import { autoTopUpChargeFailedNotification } from "./auto-top-up-charge-failed-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(autoTopUpChargeFailedNotification.name, () => {
  it("tells the user the charge failed, that retries continue, and how to fix the card", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = autoTopUpChargeFailedNotification(user, {
      chargeAttemptedAt: "2026-09-01 12:00:00",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.summary).toBe("We couldn't charge your card");
    expect(result.payload.description).toContain("declined");
    expect(result.payload.description).toContain("try again");
    expect(result.payload.actions).toEqual([{ label: "Update payment method", url: "https://console.akash.network/billing" }]);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("keys the notification on the charge attempt so a later failure is not swallowed as a duplicate", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const vars = { billingUrl: "https://console.akash.network/billing" };

    const first = autoTopUpChargeFailedNotification(user, { ...vars, chargeAttemptedAt: "2026-09-01 12:00:00" });
    const second = autoTopUpChargeFailedNotification(user, { ...vars, chargeAttemptedAt: "2026-09-20 08:30:00" });

    expect(first.notificationId).toBe("autoTopUpChargeFailed.user-123.2026-09-01 12:00:00");
    expect(second.notificationId).not.toBe(first.notificationId);
  });
});
