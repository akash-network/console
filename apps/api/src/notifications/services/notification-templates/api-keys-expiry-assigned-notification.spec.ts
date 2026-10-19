import { describe, expect, it } from "vitest";

import { apiKeysExpiryAssignedNotification } from "./api-keys-expiry-assigned-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(apiKeysExpiryAssignedNotification.name, () => {
  it("tells the owner which keys of an organization now expire and when", () => {
    const user = createUser({ id: "user-123", email: "owner@example.com" });

    const result = apiKeysExpiryAssignedNotification(user, {
      organizationId: "org-456",
      keys: [
        { name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" },
        { name: "deploy", keyFormat: "ac.sk.prod.ghijkl***opqrst" }
      ],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys?org=org-456"
    });

    expect(result).toEqual({
      notificationId: "apiKeysExpiryAssigned.user-123.org-456.2027-10-18T14:30:00.000Z",
      payload: {
        summary: "2 of your Akash Console API keys now expire on October 18, 2027",
        description:
          "<p>Akash Console API keys now expire after one year at most. " +
          "These keys of yours had no expiration, so they stop working on <strong>October 18, 2027 at 2:30 PM UTC</strong>: " +
          "<strong>ci</strong> (ac.sk.prod.abcdef***uvwxyz), <strong>deploy</strong> (ac.sk.prod.ghijkl***opqrst).</p>" +
          "<p>Before then, create new keys, switch your integrations over to them, then revoke the old ones. We will remind you 30, 7 and 1 day before they expire.</p>",
        actions: [{ label: "Manage API keys", url: "https://console.akash.network/user/api-keys?org=org-456" }]
      },
      user: { id: "user-123", email: "owner@example.com" }
    });
  });

  it("speaks of the one key when only one is affected", () => {
    const user = createUser({ id: "user-123" });

    const result = apiKeysExpiryAssignedNotification(user, {
      organizationId: null,
      keys: [{ name: "ci", keyFormat: "ac.sk.prod.abcdef***uvwxyz" }],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys"
    });

    expect(result.notificationId).toBe("apiKeysExpiryAssigned.user-123.unassigned.2027-10-18T14:30:00.000Z");
    expect(result.payload).toMatchObject({
      summary: 'Your Akash Console API key "ci" now expires on October 18, 2027',
      description:
        "<p>Akash Console API keys now expire after one year at most. " +
        "Your API key <strong>ci</strong> (ac.sk.prod.abcdef***uvwxyz) had no expiration, so it stops working on <strong>October 18, 2027 at 2:30 PM UTC</strong>.</p>" +
        "<p>Before then, create a new key, switch your integrations over to it, then revoke the old one. We will remind you 30, 7 and 1 day before it expires.</p>"
    });
  });

  it("escapes key names and formats in the email body", () => {
    const result = apiKeysExpiryAssignedNotification(createUser(), {
      organizationId: null,
      keys: [
        { name: "<b>ci</b>", keyFormat: "<i>fmt</i>" },
        { name: "deploy", keyFormat: "ac.sk.prod.ghijkl***opqrst" }
      ],
      expiresAt: "2027-10-18T14:30:00.000Z",
      apiKeysUrl: "https://console.akash.network/user/api-keys"
    });

    expect(result.payload.description).toContain("<strong>&lt;b&gt;ci&lt;/b&gt;</strong> (&lt;i&gt;fmt&lt;/i&gt;)");
  });
});
