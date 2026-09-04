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

  function command(payload: { actions?: { label: string; url: string }[]; code?: string }) {
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
