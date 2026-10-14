import { describe, expect, it } from "vitest";

import { isEmailAddress } from "./emailAddress";

describe(isEmailAddress.name, () => {
  it.each(["ada@example.com", "ada.lovelace+invites@mail.example.co"])("accepts %s", email => {
    expect(isEmailAddress(email)).toBe(true);
  });

  it.each([
    ["not-an-email", "has no @"],
    ["@example.com", "has nothing before the @"],
    ["ada@.com", "has nothing between the @ and the dot"],
    ["ada@example.", "has nothing after the dot"],
    ["ada@example", "has no dot after the @"],
    ["ada@@example.com", "has two @"],
    ["ada lovelace@example.com", "has a space"],
    [" ada@example.com", "starts with a space"],
    ["ada@example.com ", "ends with a space"]
  ])("rejects %s, which %s", email => {
    expect(isEmailAddress(email)).toBe(false);
  });
});
