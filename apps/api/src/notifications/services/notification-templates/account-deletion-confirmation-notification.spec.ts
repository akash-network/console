import { describe, expect, it } from "vitest";

import { accountDeletionConfirmationNotification } from "./account-deletion-confirmation-notification";

describe(accountDeletionConfirmationNotification.name, () => {
  it("links the confirmation page and says when the link expires", () => {
    const result = accountDeletionConfirmationNotification(
      { id: "user-123", email: "test@example.com" },
      { confirmUrl: "https://console.akash.network/user/confirm-delete#token=abc", expiresInMinutes: 15, forfeitedBalanceUsd: 0 }
    );

    expect(result.notificationId).toMatch(/^accountDeletionConfirmation\.user-123\.[0-9a-f-]{36}$/);
    expect(result.payload.summary).toBe("Confirm your Akash Console account deletion");
    expect(result.payload.description).toContain("works for 15 minutes");
    expect(result.payload.actions).toEqual([{ label: "Delete my account", url: "https://console.akash.network/user/confirm-delete#token=abc" }]);
    expect(result.user).toEqual({ id: "user-123", email: "test@example.com" });
  });

  it("names the credits the user agreed to forfeit", () => {
    const result = accountDeletionConfirmationNotification(
      { id: "user-123", email: "test@example.com" },
      { confirmUrl: "https://console.akash.network/user/confirm-delete#token=abc", expiresInMinutes: 15, forfeitedBalanceUsd: 12.5 }
    );

    expect(result.payload.description).toContain("Your remaining <strong>$12.50</strong> in credits won't be refunded.");
  });

  it("leaves the forfeit out when there is no balance to lose", () => {
    const result = accountDeletionConfirmationNotification(
      { id: "user-123", email: "test@example.com" },
      { confirmUrl: "https://console.akash.network/user/confirm-delete#token=abc", expiresInMinutes: 15, forfeitedBalanceUsd: 0 }
    );

    expect(result.payload.description).not.toContain("refunded");
  });
});
