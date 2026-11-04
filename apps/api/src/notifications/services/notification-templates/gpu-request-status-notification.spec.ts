import { describe, expect, it } from "vitest";

import { gpuRequestStatusNotification } from "./gpu-request-status-notification";

describe(gpuRequestStatusNotification.name, () => {
  it("emails the headline and detail to the requester, keyed on the timeline event", () => {
    const notification = gpuRequestStatusNotification(
      { id: "user-1", email: "jane@example.com" },
      {
        eventId: "event-1",
        headline: "GPU request: 1× A100 is being sourced",
        detail: "We're on it.",
        requestUrl: "https://console.example.com/gpu-requests/1"
      }
    );

    expect(notification).toEqual({
      notificationId: "gpuRequestStatus.event-1",
      payload: {
        summary: "GPU request: 1× A100 is being sourced",
        description: "We're on it.",
        actions: [{ label: "View request", url: "https://console.example.com/gpu-requests/1" }]
      },
      user: { id: "user-1", email: "jane@example.com" }
    });
  });

  it("leaves the link out without a request URL", () => {
    const notification = gpuRequestStatusNotification(
      { id: "user-1", email: "jane@example.com" },
      { eventId: "e", headline: "h", detail: "d", requestUrl: undefined }
    );

    expect(notification.payload.actions).toBeUndefined();
  });
});
