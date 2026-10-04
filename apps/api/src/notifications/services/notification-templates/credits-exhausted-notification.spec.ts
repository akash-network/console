import { addHours, subMinutes } from "date-fns";
import { describe, expect, it } from "vitest";

import { creditsExhaustedNotification } from "./credits-exhausted-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(creditsExhaustedNotification.name, () => {
  it("names the deployment about to close and when, with both remedies", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsExhaustedNotification(user, {
      firstClosingDseq: "654321",
      unfundedDeploymentCount: 1,
      firstClosureAt: addHours(new Date(), 6).toISOString(),
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result).toEqual({
      notificationId: "creditsExhausted.user-123",
      payload: {
        summary: "Your Akash deployment is about to close",
        description:
          "The credits left in your account are not enough to keep deployment <strong>654321</strong> running. " +
          "It will close in about 6 hours unless you add credits or turn on Auto Recharge.",
        actions: [
          { label: "Add credits", url: "https://console.akash.network/billing?openPayment=true" },
          { label: "Enable Auto Recharge", url: "https://console.akash.network/billing" }
        ]
      },
      user: { id: "user-123", email: "user@example.com" }
    });
  });

  it("counts the deployments about to close and names the first one", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsExhaustedNotification(user, {
      firstClosingDseq: "654321",
      unfundedDeploymentCount: 3,
      firstClosureAt: addHours(new Date(), 6).toISOString(),
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.summary).toBe("Your Akash deployments are about to close");
    expect(result.payload.description).toBe(
      "The credits left in your account are not enough to keep <strong>3 deployments</strong> running. " +
        "The first one, <strong>654321</strong>, will close in about 6 hours unless you add credits or turn on Auto Recharge."
    );
  });

  it("says shortly for a deployment whose funding has already run out", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = creditsExhaustedNotification(user, {
      firstClosingDseq: "654321",
      unfundedDeploymentCount: 1,
      firstClosureAt: subMinutes(new Date(), 1).toISOString(),
      paymentLink: "https://console.akash.network/billing?openPayment=true",
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.description).toContain("It will close shortly unless");
  });
});
