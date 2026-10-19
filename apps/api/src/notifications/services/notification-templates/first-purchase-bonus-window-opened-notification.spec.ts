import { describe, expect, it } from "vitest";

import { firstPurchaseBonusWindowOpenedNotification } from "./first-purchase-bonus-window-opened-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(firstPurchaseBonusWindowOpenedNotification.name, () => {
  it("tells a small first buyer the bonus is still theirs until the window closes, in UTC", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const notification = firstPurchaseBonusWindowOpenedNotification(user, {
      reason: "small_first_purchase",
      closesAt: "2026-10-26T18:00:00.000Z",
      paymentLink: "https://console.akash.network/billing?openPayment=true"
    });

    expect(notification).toEqual({
      notificationId: "firstPurchaseBonusWindowOpened.small_first_purchase.user-123",
      payload: {
        summary: "Your first-purchase bonus is still available",
        description:
          "Thanks for your first purchase on Akash Console! Your first-purchase bonus is still open until October 26, 2026 at 18:00 UTC: " +
          "buy $100 or more by then and get 10% in bonus credits, up to $100.",
        actions: [{ label: "Buy credits", url: "https://console.akash.network/billing?openPayment=true" }]
      },
      user: { id: "user-123", email: "user@example.com" }
    });
  });

  it("shows the closing time on a 24-hour clock", () => {
    const user = createUser();

    const notification = firstPurchaseBonusWindowOpenedNotification(user, {
      reason: "small_first_purchase",
      closesAt: "2026-10-26T00:05:00.000Z",
      paymentLink: "https://console.akash.network/billing"
    });

    expect(notification.payload.description).toContain("until October 26, 2026 at 00:05 UTC:");
  });
});
