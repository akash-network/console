import { describe, expect, it } from "vitest";

import { accountSuspendedNotification } from "./account-suspended-notification";

describe(accountSuspendedNotification.name, () => {
  it("includes the user reason, what still works and the support contact, keyed on the event", () => {
    const result = accountSuspendedNotification(USER, { eventId: "event-1", userReason: "Unpaid invoices", closeDeployments: false });

    expect(result).toEqual({
      notificationId: "accountSuspended.event-1",
      payload: {
        summary: "Your Akash Console account is suspended",
        description:
          "<p>We've suspended your Akash Console account.</p>" +
          "<p><strong>Reason:</strong> Unpaid invoices</p>" +
          "<p>While it's suspended, you can still sign in, check your balance and look through your deployments, billing history and invoices. " +
          "You can also close deployments. You can't deploy, add funds, buy credits or start a trial.</p>" +
          '<p>If you have questions, email us at <a href="mailto:support@akash.network">support@akash.network</a>.</p>'
      },
      user: USER
    });
  });

  it("says the running deployments are being closed when the admin asked for it", () => {
    const result = accountSuspendedNotification(USER, { eventId: "event-1", userReason: "Abuse", closeDeployments: true });

    expect(result.payload.description).toContain(
      "<p><strong>Reason:</strong> Abuse</p><p>We're also closing the deployments that were running on it.</p><p>While it's suspended"
    );
  });

  it("escapes markup in the user reason", () => {
    const result = accountSuspendedNotification(USER, { eventId: "event-1", userReason: '<a href="https://evil.example">x</a> & co', closeDeployments: false });

    expect(result.payload.description).toContain("<p><strong>Reason:</strong> &lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt; &amp; co</p>");
  });

  it("leaves the reason out when there is none", () => {
    const result = accountSuspendedNotification(USER, { eventId: "event-1", userReason: null, closeDeployments: false });

    expect(result.payload.description).not.toContain("Reason:");
  });

  const USER = { id: "user-123", email: "test@example.com" };
});
