import { describe, expect, it } from "vitest";

import { autoTopUpPausedNotification } from "./auto-top-up-paused-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(autoTopUpPausedNotification.name, () => {
  it("tells the user charging has stopped and links to their payment methods", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = autoTopUpPausedNotification(user, {
      pausedAt: new Date("2026-09-01T12:00:00.000Z"),
      billingUrl: "https://console.akash.network/billing"
    });

    expect(result.payload.summary).toBe("Auto top-up is paused");
    expect(result.payload.description).toContain("declined");
    expect(result.payload.description).toContain('<a href="https://console.akash.network/billing">');
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("keys the notification on the pause so a later one is not swallowed as a duplicate", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });
    const vars = { billingUrl: "https://console.akash.network/billing" };

    const first = autoTopUpPausedNotification(user, { ...vars, pausedAt: new Date("2026-09-01T12:00:00.000Z") });
    const second = autoTopUpPausedNotification(user, { ...vars, pausedAt: new Date("2026-09-20T08:30:00.000Z") });

    expect(first.notificationId).toBe("autoTopUpPaused.user-123.2026-09-01T12:00:00.000Z");
    expect(second.notificationId).not.toBe(first.notificationId);
  });
});
