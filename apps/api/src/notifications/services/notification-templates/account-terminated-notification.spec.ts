import { describe, expect, it } from "vitest";

import { accountTerminatedNotification } from "./account-terminated-notification";

describe(accountTerminatedNotification.name, () => {
  it("includes the user reason, the kept credits and the support contact, keyed on the event", () => {
    const result = accountTerminatedNotification(USER, { eventId: "event-1", userReason: "Fraud", creditsForfeited: false });

    expect(result).toEqual({
      notificationId: "accountTerminated.event-1",
      payload: {
        summary: "Your Akash Console account has been terminated",
        description:
          "<p>We've terminated your Akash Console account. This decision is final.</p>" +
          "<p><strong>Reason:</strong> Fraud</p>" +
          "<p>We're closing any deployments still running on it. The credits left on the account stay there, but you can't spend them.</p>" +
          "<p>You can still sign in to see your billing history and invoices.</p>" +
          '<p>If you have questions, email us at <a href="mailto:support@akash.network">support@akash.network</a>.</p>'
      },
      user: USER
    });
  });

  it("says the credits are forfeited when the admin chose to forfeit them", () => {
    const result = accountTerminatedNotification(USER, { eventId: "event-1", userReason: "Fraud", creditsForfeited: true });

    expect(result.payload.description).toContain(
      "<p>We're closing any deployments still running on it. The credits left on the account are forfeited and won't be refunded.</p>"
    );
    expect(result.payload.description).not.toContain("you can't spend them");
  });

  it("escapes markup in the user reason", () => {
    const result = accountTerminatedNotification(USER, { eventId: "event-1", userReason: "<b>Fraud</b>", creditsForfeited: false });

    expect(result.payload.description).toContain("<p><strong>Reason:</strong> &lt;b&gt;Fraud&lt;/b&gt;</p>");
  });

  it("leaves the reason out when there is none", () => {
    const result = accountTerminatedNotification(USER, { eventId: "event-1", userReason: null, creditsForfeited: false });

    expect(result.payload.description).not.toContain("Reason:");
  });

  const USER = { id: "user-123", email: "test@example.com" };
});
