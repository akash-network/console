import { describe, expect, it } from "vitest";

import { firstPurchaseBonusGrantedNotification } from "./first-purchase-bonus-granted-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(firstPurchaseBonusGrantedNotification.name, () => {
  it("returns a notification describing the granted bonus and paid amount", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = firstPurchaseBonusGrantedNotification(user, { bonusAmountCents: 1500, paidAmountCents: 15000 });

    expect(result.notificationId).toBe("firstPurchaseBonusGranted.user-123");
    expect(result.payload.summary).toBe("You earned $15.00 in bonus credits");
    expect(result.payload.description).toContain("<strong>$15.00</strong>");
    expect(result.payload.description).toContain("$150.00");
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });
});
