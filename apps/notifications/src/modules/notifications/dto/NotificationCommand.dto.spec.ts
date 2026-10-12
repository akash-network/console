import { describe, expect, it } from "vitest";

import { NotificationCommandDto } from "./NotificationCommand.dto";

describe(NotificationCommandDto.name, () => {
  it("keeps the actions the email layout renders as buttons", () => {
    const actions = [
      { label: "Add credits", url: "https://console.akash.network/billing?openPayment=true" },
      { label: "Enable Auto Recharge", url: "https://console.akash.network/billing" }
    ];

    const result = NotificationCommandDto.schema.parse(command({ actions }));

    expect(result.payload.actions).toEqual(actions);
  });

  it("keeps the verification code the email layout renders as a block", () => {
    const result = NotificationCommandDto.schema.parse(command({ code: "418902" }));

    expect(result.payload.code).toBe("418902");
  });

  it("accepts a command without actions", () => {
    const result = NotificationCommandDto.schema.parse(command({}));

    expect(result.payload.actions).toBeUndefined();
  });

  it("rejects an action url that is not a url", () => {
    const result = NotificationCommandDto.schema.safeParse(command({ actions: [{ label: "Add credits", url: "not-a-url" }] }));

    expect(result.success).toBe(false);
  });

  it("keeps the feed entry of an alert that also shows in the activity feed", () => {
    const feedEntry = { type: "deployment_closed_alert", alertId: "alert-1", dedupeKey: "deployment_close.4242", dseq: "4242" };

    const result = NotificationCommandDto.schema.parse(command({ feedEntry }));

    expect(result.payload.feedEntry).toEqual(feedEntry);
  });

  it("drops a feed entry it cannot read but keeps the notification, so its email still goes out", () => {
    const result = NotificationCommandDto.schema.parse(command({ code: "418902", feedEntry: { type: "provider_maintenance_alert", alertId: "alert-1" } }));

    expect(result.payload).toEqual({
      summary: "Your Akash credits are running low",
      description: "Your remaining credits are <strong>$4.20</strong>.",
      code: "418902",
      feedEntry: undefined
    });
  });

  function command(payload: { actions?: { label: string; url: string }[]; code?: string; feedEntry?: Record<string, string> }) {
    return {
      notificationChannelId: "channel-1",
      notificationId: "creditsRunningLow.user-1",
      payload: {
        summary: "Your Akash credits are running low",
        description: "Your remaining credits are <strong>$4.20</strong>.",
        ...payload
      }
    };
  }
});
