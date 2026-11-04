import { describe, expect, it } from "vitest";

import { responseTargetEmail, responseTargetEscalationSlackText } from "./hardware-request-response-target-notice";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe("response target notices", () => {
  const hardwareRequest = createHardwareRequest({ id: "request-1", category: "gpu_model", gpuModel: "H100", quantity: 8, contactEmail: "a<b@example.com" });
  const recipient = { id: "recipient-1", email: "owner@akash.network" };

  describe(responseTargetEmail.name, () => {
    it("warns the owner that a target is due soon, keyed on the request, target and stage", () => {
      expect(responseTargetEmail({ hardwareRequest, target: "first_reply", stage: "reminder", dueLabel: "Tue, Nov 10, 2:00 PM EST", recipient })).toEqual({
        notificationId: "hardwareRequestResponseTarget.request-1.first_reply.reminder",
        payload: {
          summary: "The first reply is due soon: GPU request: 8× H100",
          description:
            "<p>The first reply on this request is due by Tue, Nov 10, 2:00 PM EST.</p>" +
            "<p><strong>Request ID:</strong><br>request-1</p>" +
            '<p><strong>Contact:</strong> <a href="mailto:a&lt;b@example.com">a&lt;b@example.com</a></p>'
        },
        user: recipient
      });
    });

    it("tells the lead a target was missed", () => {
      const notification = responseTargetEmail({ hardwareRequest, target: "first_offer", stage: "escalation", dueLabel: "Thu <noon>", recipient });

      expect(notification.notificationId).toBe("hardwareRequestResponseTarget.request-1.first_offer.escalation");
      expect(notification.payload.summary).toBe("The first offer target was missed: GPU request: 8× H100");
      expect(notification.payload.description).toContain("<p>The first offer on this request was due by Thu &lt;noon&gt;.</p>");
    });
  });

  describe(responseTargetEscalationSlackText.name, () => {
    it("mentions the lead and the owner by Slack id or by name", () => {
      const text = responseTargetEscalationSlackText({
        hardwareRequest,
        target: "first_offer",
        stage: "escalation",
        dueLabel: "Thu <noon> & on",
        lead: { name: "Lead", slackUserId: "U1" },
        owner: { name: "Remington <R>" }
      });

      expect(text).toBe(
        ":rotating_light: *Missed first offer target* on GPU request: 8× H100, due Thu &lt;noon&gt; &amp; on\n<@U1> · Remington &lt;R&gt; · Request request-1"
      );
    });

    it("names only the request when there is no lead or owner", () => {
      const text = responseTargetEscalationSlackText({ hardwareRequest, target: "first_reply", stage: "escalation", dueLabel: "soon" });

      expect(text.split("\n")).toEqual([":rotating_light: *Missed first reply target* on GPU request: 8× H100, due soon", "Request request-1"]);
    });
  });
});
