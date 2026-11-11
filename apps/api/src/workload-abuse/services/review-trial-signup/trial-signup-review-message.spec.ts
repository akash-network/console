import { describe, expect, it } from "vitest";

import { buildTrialSignupReviewMessage } from "./trial-signup-review-message";

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

  it("heads a held trial differently from a flagged sign-up", () => {
    const message = buildTrialSignupReviewMessage({
      account: { id: "signup-id", email: "signup@example.com" },
      linkedAccounts: [{ id: "linked-a", email: "a@example.com" }],
      held: true
    });

    expect(message.text).toBe([":no_entry: *Trial held pending review*", "signup@example.com", "Linked accounts (1):", "• a@example.com"].join("\n"));
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
