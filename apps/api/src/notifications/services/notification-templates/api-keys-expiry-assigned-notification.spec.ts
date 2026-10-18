import { describe, expect, it } from "vitest";

import { apiKeysExpiryAssignedNotification } from "./api-keys-expiry-assigned-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(apiKeysExpiryAssignedNotification.name, () => {
  it("tells the owner which keys now expire and when, once per owner and expiry", () => {
    const user = createUser({ id: "user-123", email: "owner@example.com" });

    const result = apiKeysExpiryAssignedNotification(user, {
      keys: [
        { name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" },
        { name: "deploy", keyFormat: "ac.sk.prod.ghijkl***opqrst" }
      ],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys"
    });

    expect(result).toEqual({
      notificationId: "apiKeysExpiryAssigned.user-123.2027-10-18T14:30:00.000Z",
      payload: {
        summary: "2 of your Akash Console API keys now expire on October 18, 2027",
        description:
          "<p>Akash Console API keys now expire after one year at most. " +
          "These keys of yours had no expiration, so they stop working on <strong>October 18, 2027 at 2:30 PM UTC</strong>: " +
          "<strong>ci</strong> (ac.sk.prod.abcdef***uvwxyz), <strong>deploy</strong> (ac.sk.prod.ghijkl***opqrst).</p>" +
          "<p>Before then, create new keys, switch your integrations over to them, then revoke the old ones. We will remind you 30, 7 and 1 day before they expire.</p>",
        actions: [{ label: "Manage API keys", url: "https://console.akash.network/user/api-keys" }]
      },
      user: { id: "user-123", email: "owner@example.com" }
    });
  });

  it("names the key in the subject when only one key is affected", () => {
    const result = apiKeysExpiryAssignedNotification(createUser(), {
      keys: [{ name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys"
    });

    expect(result.payload.summary).toBe('Your Akash Console API key "ci" now expires on October 18, 2027');
  });

  it("escapes key names in the email body", () => {
    const result = apiKeysExpiryAssignedNotification(createUser(), {
      keys: [{ name: "<b>ci</b>", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys"
    });

    expect(result.payload.description).toContain("<strong>&lt;b&gt;ci&lt;/b&gt;</strong>");
  });
});
