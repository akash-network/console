import { describe, expect, it } from "vitest";

import { trialDeploymentClosedNotification } from "./trial-deployment-closed";

import { createUser } from "@test/seeders/user.seeder";

describe(trialDeploymentClosedNotification.name, () => {
  it("renders the deployment-closed summary and appends the first-purchase bonus offer", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = trialDeploymentClosedNotification(user, {
      dseq: "123456",
      owner: "akash1test",
      deploymentLifetimeInHours: 24,
      firstPurchaseBonus: { bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 }
    });

    expect(result.payload.summary).toBe("Your Trial Deployment Has Been Closed");
    expect(result.payload.description).toContain("has been closed by the system");
    expect(result.payload.description).toContain("10% in bonus credits");
  });
});
