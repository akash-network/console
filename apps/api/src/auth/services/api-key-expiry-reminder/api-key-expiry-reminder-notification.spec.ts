import { describe, expect, it } from "vitest";

import { apiKeyExpiryReminderNotification } from "./api-key-expiry-reminder-notification";

describe(apiKeyExpiryReminderNotification.name, () => {
  it("tells the owner which key expires when and links to the API keys page", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com", timezone: null },
      {
        apiKeyId: "key-456",
        keys: [{ name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
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

  it("lists every key in one reminder when several expire at the same time", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com", timezone: null },
      {
        apiKeyId: "key-456",
        keys: [
          { name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" },
          { name: "deploy", keyFormat: "ac.sk.prod.ghijkl***opqrst" }
        ],
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 7,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload).toEqual({
      summary: "2 of your Akash Console API keys expire in 7 days",
      description:
        "<p>These API keys expire on <strong>October 18, 2027 at 2:30 PM UTC</strong>: " +
        "<strong>ci</strong> (ac.sk.prod.abcdef***uvwxyz), <strong>deploy</strong> (ac.sk.prod.ghijkl***opqrst). Requests made with them are rejected after that.</p>" +
        "<p>To keep your integrations running, create new keys, switch them over, then revoke these ones.</p>",
      actions: [{ label: "Manage API keys", url: "https://console.akash.network/user/api-keys" }]
    });
  });

  it("shows the expiry in the owner's timezone and names it", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com", timezone: "America/Los_Angeles" },
      {
        apiKeyId: "key-456",
        keys: [{ name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 30,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload.description).toContain("expires on <strong>October 18, 2027 at 7:30 AM Pacific Daylight Time</strong>");
    expect(result.user).toEqual({ id: "user-123", email: "owner@example.com" });
  });

  it("says the key expires tomorrow on the last reminder", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com", timezone: null },
      {
        apiKeyId: "key-456",
        keys: [{ name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 1,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload.summary).toBe('Your Akash Console API key "ci" expires tomorrow');
  });

  it("escapes key names and formats in the email body", () => {
    const result = apiKeyExpiryReminderNotification(
      { id: "user-123", email: "owner@example.com", timezone: null },
      {
        apiKeyId: "key-456",
        keys: [
          { name: "<b>ci</b>", keyFormat: "<i>fmt</i>" },
          { name: "<u>deploy</u>", keyFormat: "ac.sk.prod.ghijkl***opqrst" }
        ],
        expiresAt: "2027-10-18T14:30:00.000Z",
        daysBeforeExpiry: 7,
        apiKeysUrl: "https://console.akash.network/user/api-keys"
      }
    );

    expect(result.payload.description).toContain("<strong>&lt;b&gt;ci&lt;/b&gt;</strong> (&lt;i&gt;fmt&lt;/i&gt;), <strong>&lt;u&gt;deploy&lt;/u&gt;</strong>");
  });
});
