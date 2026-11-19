import { describe, expect, it } from "vitest";

import { gpuStillWantedNotification } from "./gpu-alert-still-wanted-notification";

describe(gpuStillWantedNotification.name, () => {
  it("asks whether the setup is still wanted with keep and stop links and the grace period", () => {
    const notification = setup({});

    expect(notification).toEqual({
      notificationId: "gpuStillWanted.entry-1.1700000000000",
      payload: {
        summary: "Still want 8× H100?",
        description: "<p>You're waiting for 8× H100 on Akash. Do you still want it?</p><p>If you don't answer, this alert ends on its own in 7 days.</p>",
        actions: [
          { label: "Keep this alert", url: "https://console.example.com/gpu-requests?keepAlert=entry-1" },
          { label: "Stop these alerts", url: "https://console.example.com/gpu-requests?leaveAlert=entry-1" }
        ]
      },
      user: { id: "user-1", email: "jane@example.com" }
    });
  });

  it("escapes the setup label in the description", () => {
    const notification = setup({ setupLabel: "<script>alert(1)</script>" });

    expect(notification.payload.description).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(notification.payload.description).not.toContain("<script>");
  });

  it("keys the notification on the moment the question was asked", () => {
    const first = setup({ askedAtEpochMs: 1 });
    const second = setup({ askedAtEpochMs: 2 });

    expect(first.notificationId).not.toBe(second.notificationId);
  });

  function setup(input: { setupLabel?: string; askedAtEpochMs?: number }) {
    return gpuStillWantedNotification(
      { id: "user-1", email: "jane@example.com" },
      {
        entryId: "entry-1",
        askedAtEpochMs: input.askedAtEpochMs ?? 1_700_000_000_000,
        setupLabel: input.setupLabel ?? "8× H100",
        graceDays: 7,
        keepUrl: "https://console.example.com/gpu-requests?keepAlert=entry-1",
        leaveUrl: "https://console.example.com/gpu-requests?leaveAlert=entry-1"
      }
    );
  }
});
