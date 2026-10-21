import { describe, expect, it } from "vitest";

import { firstPurchaseBonusWindowReminderNotification } from "./first-purchase-bonus-window-reminder-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(firstPurchaseBonusWindowReminderNotification.name, () => {
  it("reminds a small first buyer that the bonus ends in 2 days, with the closing time in UTC", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const notification = firstPurchaseBonusWindowReminderNotification(user, {
      reason: "small_first_purchase",
      closesAt: "2026-10-26T18:00:00.000Z",
      paymentLink: "https://console.akash.network/billing?openPayment=true"
    });

    expect(notification).toEqual({
      notificationId: "firstPurchaseBonusWindowReminder.small_first_purchase.user-123",
      payload: {
        summary: "2 days left to get your first-purchase bonus",
        description:
          "Your first-purchase bonus ends on October 26, 2026 at 18:00 UTC. " +
          "Buy $100 or more in credits before then and we'll add 10% in bonus credits, up to $100.",
        actions: [{ label: "Buy credits", url: "https://console.akash.network/billing?openPayment=true" }]
      },
      user: { id: "user-123", email: "user@example.com" }
    });
  });
});
