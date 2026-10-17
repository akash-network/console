import { describe, expect, it } from "vitest";

import { NotificationCommandDto } from "./NotificationCommand.dto";

const FEED_ENTRY = {
  type: "wallet_balance_alert",
  alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b",
  userId: "0d3b5f7a-9c1e-4b2d-8f6a-7e5c3a1b9d0f",
  organizationId: "6a8c0e2f-4b6d-4f8a-9c2e-1b3d5f7a9c0e",
  projectId: "9e7c5a3f-1d0b-4e8c-a6f4-2b0d8e6c4a2f",
  dedupeKey: "wallet_balance_alert.4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b.1"
};

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
    const feedEntry = { ...FEED_ENTRY, type: "deployment_closed_alert", dedupeKey: "deployment_close.akash1owner.4242", dseq: "4242" };

    const result = NotificationCommandDto.schema.parse(command({ feedEntry }));

    expect(result.payload.feedEntry).toEqual(feedEntry);
  });

  it("keeps the feed entry of an alert set before organizations, which is filed in no organization or project", () => {
    const feedEntry = { ...FEED_ENTRY, organizationId: null, projectId: null };

    const result = NotificationCommandDto.schema.parse(command({ feedEntry }));

    expect(result.payload.feedEntry).toEqual(feedEntry);
  });

  it.each([
    ["an alert type the feed does not know", { ...FEED_ENTRY, type: "provider_maintenance_alert" }],
    ["no user to write it for", { ...FEED_ENTRY, userId: undefined }],
    ["a user id that is not a uuid", { ...FEED_ENTRY, userId: "user-1" }],
    ["an alert id that is not a uuid", { ...FEED_ENTRY, alertId: "alert-1" }],
    ["no organization it is filed in", { ...FEED_ENTRY, organizationId: undefined }],
    ["an organization id that is not a uuid", { ...FEED_ENTRY, organizationId: "team-1" }],
    ["a project id that is not a uuid", { ...FEED_ENTRY, projectId: "project-1" }],
    ["an empty dedupe key", { ...FEED_ENTRY, dedupeKey: "" }],
    ["an empty dseq", { ...FEED_ENTRY, dseq: "" }]
  ])("drops a feed entry with %s but keeps the notification, so its email still goes out", (_, feedEntry) => {
    const result = NotificationCommandDto.schema.parse(command({ code: "418902", feedEntry }));

    expect(result.payload).toEqual({
      summary: "Your Akash credits are running low",
      description: "Your remaining credits are <strong>$4.20</strong>.",
      code: "418902",
      feedEntry: undefined
    });
  });

  function command(payload: { actions?: { label: string; url: string }[]; code?: string; feedEntry?: Record<string, string | null | undefined> }) {
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
