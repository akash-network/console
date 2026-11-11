import { describe, expect, it } from "vitest";

import { gpuRequestReceivedNotification } from "./gpu-request-received-notification";

describe(gpuRequestReceivedNotification.name, () => {
  it("emails the confirmation to the requester, keyed on the request", () => {
    const notification = gpuRequestReceivedNotification(
      { id: "user-1", email: "jane@example.com" },
      {
        hardwareRequestId: "request-1",
        headline: "GPU request: 8× B200 was received",
        detail: "Our team will reply soon.",
        requestUrl: "https://console.example.com/gpu-requests/request-1"
      }
    );

    expect(notification).toEqual({
      notificationId: "gpuRequestReceived.request-1",
      payload: {
        summary: "GPU request: 8× B200 was received",
        description: "Our team will reply soon.",
        actions: [{ label: "View request", url: "https://console.example.com/gpu-requests/request-1" }]
      },
      user: { id: "user-1", email: "jane@example.com" }
    });
  });

  it("leaves the link out without a request URL", () => {
    const notification = gpuRequestReceivedNotification(
      { id: "user-1", email: "jane@example.com" },
      { hardwareRequestId: "r", headline: "h", detail: "d", requestUrl: undefined }
    );

    expect(notification.payload.actions).toBeUndefined();
  });
});
