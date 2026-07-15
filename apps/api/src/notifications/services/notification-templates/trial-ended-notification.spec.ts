import { describe, expect, it } from "vitest";

import { trialEndedNotification } from "./trial-ended-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(trialEndedNotification.name, () => {
  it("renders the trial-ended summary and appends the first-purchase bonus offer", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = trialEndedNotification(user, {
      paymentLink: "https://console.akash.network/billing",
      firstPurchaseBonus: { bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 }
    });

    expect(result.payload.summary).toBe("Your Free Trial Has Ended");
    expect(result.payload.description).toContain("has ended");
    expect(result.payload.description).toContain("10% in bonus credits");
  });
});
