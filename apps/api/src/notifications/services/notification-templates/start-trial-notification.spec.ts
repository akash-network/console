import { describe, expect, it } from "vitest";

import { startTrialNotification } from "./start-trial-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(startTrialNotification.name, () => {
  it("renders the welcome summary with the trial end date and deployment limit", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = startTrialNotification(user, {
      trialEndsAt: "2025-10-22T07:58:47.770Z",
      deploymentLifetimeInHours: 24
    });

    expect(result.notificationId).toBe("startTrial.user-123");
    expect(result.payload.summary).toBe("Welcome to Akash! Your trial is ready");
    expect(result.payload.description).toContain("Oct 22, 2025");
    expect(result.payload.description).toContain("24 hours");
  });

  it("shows when the trial ends in the user's timezone and names it", () => {
    const user = createUser({ id: "user-123", email: "user@example.com", timezone: "Asia/Kolkata" });

    const result = startTrialNotification(user, {
      trialEndsAt: "2025-10-22T07:58:47.770Z",
      deploymentLifetimeInHours: 24
    });

    expect(result.payload.description).toContain("Your trial ends at Oct 22, 2025, 13:28 India Standard Time, and");
  });

  it("shows when the trial ends in UTC when the user's timezone is unknown", () => {
    const user = createUser({ id: "user-123", email: "user@example.com", timezone: null });

    const result = startTrialNotification(user, {
      trialEndsAt: "2025-10-22T07:58:47.770Z",
      deploymentLifetimeInHours: 24
    });

    expect(result.payload.description).toContain("Your trial ends at Oct 22, 2025, 07:58 UTC, and");
  });

  it("does not disclose a specific credit amount", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = startTrialNotification(user, {
      trialEndsAt: "2025-10-22T07:58:47.770Z",
      deploymentLifetimeInHours: 24
    });

    expect(result.payload.description).not.toMatch(/(?:\$\s*\d|\b\d[\d,]*(?:\.\d+)?\s*(?:credits?|USD|dollars?))/i);
  });
});
