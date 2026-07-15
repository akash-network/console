import { describe, expect, it } from "vitest";

import { beforeTrialEndsNotification } from "./before-trial-ends-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(beforeTrialEndsNotification.name, () => {
  const baseVars = {
    trialEndsAt: "2025-10-22T07:58:47.770Z",
    paymentLink: "https://console.akash.network/billing",
    remainingCredits: 42,
    activeDeployments: 2
  };

  it("renders the trial-ending summary and appends the first-purchase bonus offer", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = beforeTrialEndsNotification(user, { ...baseVars, firstPurchaseBonus: { bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 } });

    expect(result.payload.summary).toBe("Your Free Trial is Ending Soon");
    expect(result.payload.description).toContain("$42 in free credits");
    expect(result.payload.description).toContain("10% in bonus credits");
  });
});
