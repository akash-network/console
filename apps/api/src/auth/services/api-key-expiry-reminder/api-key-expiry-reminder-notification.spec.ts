import { describe, expect, it } from "vitest";

import { apiKeyExpiryReminderNotification } from "./api-key-expiry-reminder-notification";

describe(apiKeyExpiryReminderNotification.name, () => {
  it("tells the owner which key expires when and links to the API keys page, once per key, expiry and lead time", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com" },
      {
        apiKeyId: "key-456",
        name: "ci",
        keyFormat: "ac.sk.prod.abcdef***uvwxyz",
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 30,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result).toEqual({
      notificationId: "apiKeyExpiryReminder.key-456.2027-10-18T14:30:00.000Z.30",
      payload: {
        summary: 'Your Akash Console API key "ci" expires in 30 days',
        description:
          "<p>Your API key <strong>ci</strong> (ac.sk.prod.abcdef***uvwxyz) expires on <strong>October 18, 2027 at 2:30 PM UTC</strong>. " +
          "Requests made with it are rejected after that.</p>" +
          "<p>To keep your integrations running, create a new key, switch them over to it, then revoke this one.</p>",
        actions: [{ label: "Manage API keys", url: "https://console.akash.network/user/api-keys" }]
      },
      user: { id: "user-123", email: "owner@example.com" }
    });
  });

  it("says the key expires tomorrow on the last reminder", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com" },
      {
        apiKeyId: "key-456",
        name: "ci",
        keyFormat: "ac.sk.prod.abcdef***uvwxyz",
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 1,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload.summary).toBe('Your Akash Console API key "ci" expires tomorrow');
  });

  it("escapes the key name in the email body", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com" },
      {
        apiKeyId: "key-456",
        name: "<b>ci</b>",
        keyFormat: "ac.sk.prod.abcdef***uvwxyz",
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 7,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload.description).toContain("<strong>&lt;b&gt;ci&lt;/b&gt;</strong>");
  });
});
