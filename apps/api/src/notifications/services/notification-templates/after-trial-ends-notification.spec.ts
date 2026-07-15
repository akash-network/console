import { describe, expect, it } from "vitest";

import { afterTrialEndsNotification } from "./after-trial-ends-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(afterTrialEndsNotification.name, () => {
  it("renders the add-payment summary and appends the first-purchase bonus offer", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = afterTrialEndsNotification(user, {
      paymentLink: "https://console.akash.network/billing",
      firstPurchaseBonus: { bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 }
    });

    expect(result.payload.summary).toBe("Add payment info to continue using Akash");
    expect(result.payload.description).toContain("trial period with Akash Network has ended");
    expect(result.payload.description).toContain("10% in bonus credits");
  });
});
