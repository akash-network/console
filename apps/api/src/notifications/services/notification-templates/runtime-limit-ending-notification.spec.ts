import { addHours, subMinutes } from "date-fns";
import { describe, expect, it } from "vitest";

import { runtimeLimitEndingNotification } from "./runtime-limit-ending-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(runtimeLimitEndingNotification.name, () => {
  it("returns a notification naming the deployment and linking to its settings tab", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const runtimeEndsAt = addHours(new Date(), 6);

    const result = runtimeLimitEndingNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      runtimeEndsAt: runtimeEndsAt.toISOString(),
      deploymentSettingsUrl: "https://console.akash.network/deployments/654321?tab=SETTINGS"
    });

    expect(result.notificationId).toBe(`runtimeLimitEnding.${runtimeEndsAt.toISOString()}.654321.akash1owner`);
    expect(result.payload.summary).toBe("Your Akash deployment stops soon");
    expect(result.payload.description).toContain("<strong>654321</strong>");
    expect(result.payload.description).toContain("in about 6 hours");
    expect(result.payload.description).toContain(
      '<a href="https://console.akash.network/deployments/654321?tab=SETTINGS">extend the limit or switch it to always-on funding</a>'
    );
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("keys the notification id on the deadline so an extension is warned about again", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const vars = { dseq: "654321", owner: "akash1owner", deploymentSettingsUrl: "https://console.akash.network/deployments/654321?tab=SETTINGS" };

    const first = runtimeLimitEndingNotification(user, { ...vars, runtimeEndsAt: addHours(new Date(), 6).toISOString() });
    const extended = runtimeLimitEndingNotification(user, { ...vars, runtimeEndsAt: addHours(new Date(), 30).toISOString() });

    expect(first.notificationId).not.toBe(extended.notificationId);
  });

  it("says a few seconds when the deadline has already passed", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = runtimeLimitEndingNotification(user, {
      dseq: "654321",
      owner: "akash1owner",
      runtimeEndsAt: subMinutes(new Date(), 1).toISOString(),
      deploymentSettingsUrl: "https://console.akash.network/deployments/654321?tab=SETTINGS"
    });

    expect(result.payload.description).toContain("reaches its runtime limit in a few seconds");
  });
});
