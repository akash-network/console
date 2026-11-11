import { describe, expect, it } from "vitest";

import { buildRefusedTrialReviewMessage, buildTrialSignupReviewMessage } from "./trial-signup-review-message";

const ADMIN_URL = "https://console-admin.example.com";

describe(buildTrialSignupReviewMessage.name, () => {
  it("names the sign-up and every linked account with a link to its admin page", () => {
    const message = buildTrialSignupReviewMessage({
      account: { id: "signup-id", email: "signup@example.com" },
      linkedAccounts: [
        { id: "linked-a", email: "a@example.com" },
        { id: "linked-b", email: "b@example.com" }
      ],
      adminUrl: ADMIN_URL
    });

    expect(message.text).toBe(
      [
        ":mag: *Trial sign-up flagged for review*",
        `signup@example.com · <${ADMIN_URL}/users/signup-id|Admin>`,
        "Linked accounts (2):",
        `• a@example.com · <${ADMIN_URL}/users/linked-a|Admin>`,
        `• b@example.com · <${ADMIN_URL}/users/linked-b|Admin>`
      ].join("\n")
    );
  });

  it("names an account without an email by its id and leaves out admin links when no admin url is set", () => {
    const message = buildTrialSignupReviewMessage({
      account: { id: "signup-id", email: null },
      linkedAccounts: [{ id: "linked-a", email: "a@example.com" }]
    });

    expect(message.text.split("\n").slice(1)).toEqual(["signup-id", "Linked accounts (1):", "• a@example.com"]);
  });

  it("escapes Slack control characters in an email", () => {
    const message = buildTrialSignupReviewMessage({
      account: { id: "signup-id", email: "<odd>&@example.com" },
      linkedAccounts: []
    });

    expect(message.text.split("\n")[1]).toBe("&lt;odd&gt;&amp;@example.com");
  });

  it("encodes the account id in its admin link", () => {
    const message = buildTrialSignupReviewMessage({
      account: { id: "a/b", email: "signup@example.com" },
      linkedAccounts: [],
      adminUrl: ADMIN_URL
    });

    expect(message.text.split("\n")[1]).toBe(`signup@example.com · <${ADMIN_URL}/users/a%2Fb|Admin>`);
  });
});

describe(buildRefusedTrialReviewMessage.name, () => {
  it("names the refused account with its admin link and the deleted account it matched", () => {
    const message = buildRefusedTrialReviewMessage({
      account: { id: "refused-id", email: "refused@example.com" },
      deletedAccount: { walletAddress: "akash1deleted", deletedAt: "2026-06-15T12:00:00.000Z", deletionsOnRecord: 2 },
      adminUrl: ADMIN_URL
    });

    expect(message.text).toBe(
      [
        ":no_entry_sign: *Trial refused to a returning account*",
        `refused@example.com · <${ADMIN_URL}/users/refused-id|Admin>`,
        "Matched deleted account: wallet akash1deleted · deleted 2026-06-15T12:00:00.000Z",
        "Deleted trial accounts on record: 2"
      ].join("\n")
    );
  });

  it("says so when the deleted account's wallet address is not on record, and leaves out the admin link when no admin url is set", () => {
    const message = buildRefusedTrialReviewMessage({
      account: { id: "refused-id", email: null },
      deletedAccount: { walletAddress: null, deletedAt: "2026-06-15T12:00:00.000Z", deletionsOnRecord: 1 }
    });

    expect(message.text.split("\n").slice(1)).toEqual([
      "refused-id",
      "Matched deleted account: wallet not on record · deleted 2026-06-15T12:00:00.000Z",
      "Deleted trial accounts on record: 1"
    ]);
  });

  it("escapes Slack control characters in what the queued review carries", () => {
    const message = buildRefusedTrialReviewMessage({
      account: { id: "refused-id", email: "refused@example.com" },
      deletedAccount: { walletAddress: "<akash>&", deletedAt: "<then>&", deletionsOnRecord: 1 }
    });

    expect(message.text.split("\n")[2]).toBe("Matched deleted account: wallet &lt;akash&gt;&amp; · deleted &lt;then&gt;&amp;");
  });
});
