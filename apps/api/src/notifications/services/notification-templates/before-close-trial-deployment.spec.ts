import { describe, expect, it } from "vitest";

import { beforeCloseTrialDeploymentNotification } from "./before-close-trial-deployment";

import { createUser } from "@test/seeders/user.seeder";

describe(beforeCloseTrialDeploymentNotification.name, () => {
  it("renders the deployment-ending summary and appends the first-purchase bonus offer", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = beforeCloseTrialDeploymentNotification(user, {
      deploymentClosedAt: "2025-10-22T07:58:47.770Z",
      dseq: "123456",
      owner: "akash1test",
      firstPurchaseBonus: { bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 }
    });

    expect(result.payload.summary).toBe("Your Trial Deployment Ends Soon");
    expect(result.payload.description).toContain("Your trial deployment will end");
    expect(result.payload.description).toContain("10% in bonus credits");
  });
});
