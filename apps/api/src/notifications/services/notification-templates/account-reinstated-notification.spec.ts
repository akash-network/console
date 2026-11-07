import { describe, expect, it } from "vitest";

import { accountReinstatedNotification } from "./account-reinstated-notification";

describe(accountReinstatedNotification.name, () => {
  it("says the account is active again and gives the support contact, keyed on the event", () => {
    const user = { id: "user-123", email: "test@example.com" };

    const result = accountReinstatedNotification(user, { eventId: "event-1" });

    expect(result).toEqual({
      notificationId: "accountReinstated.event-1",
      payload: {
        summary: "Your Akash Console account is active again",
        description:
          "<p>We've lifted the suspension on your Akash Console account. Everything works as it did before, so you can deploy, add funds and buy credits again.</p>" +
          '<p>If you have questions, email us at <a href="mailto:support@akash.network">support@akash.network</a>.</p>'
      },
      user
    });
  });
});
