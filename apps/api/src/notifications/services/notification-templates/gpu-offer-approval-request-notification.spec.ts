import { describe, expect, it } from "vitest";

import { gpuOfferApprovalRequestNotification } from "./gpu-offer-approval-request-notification";

describe(gpuOfferApprovalRequestNotification.name, () => {
  it("asks an approver to accept the offer, keyed on the timeline event and the approver", () => {
    const notification = gpuOfferApprovalRequestNotification(
      { id: "user-1", email: "owner@example.com" },
      {
        eventId: "event-1",
        requestedBy: "jane<b>",
        requestTitle: "GPU request: 8× H100",
        offerSummary: "8× H100 in Frankfurt, DE at $2.4/GPU-hour",
        requestUrl: "https://console.example.com/gpu-requests/1"
      }
    );

    expect(notification).toEqual({
      notificationId: "gpuOfferApprovalRequest.event-1.user-1",
      payload: {
        summary: "jane<b> asks you to accept a GPU offer",
        description:
          "<p><strong>GPU request: 8× H100</strong><br>8× H100 in Frankfurt, DE at $2.4/GPU-hour</p>" +
          "<p>jane&lt;b&gt; picked this offer. Only owners and admins of the organization can accept it.</p>",
        actions: [{ label: "Review offer", url: "https://console.example.com/gpu-requests/1" }]
      },
      user: { id: "user-1", email: "owner@example.com" }
    });
  });

  it("leaves the link out without a request URL", () => {
    const notification = gpuOfferApprovalRequestNotification(
      { id: "user-1", email: "owner@example.com" },
      { eventId: "e", requestedBy: "r", requestTitle: "t", offerSummary: "o", requestUrl: undefined }
    );

    expect(notification.payload.actions).toBeUndefined();
  });
});
