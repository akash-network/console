import { describe, expect, it } from "vitest";

import { hasGeneratedPlusTag } from "./generated-email-tag";

describe(hasGeneratedPlusTag.name, () => {
  it.each([
    "veliarothmann5510+y177lq10ru@hotmail.com",
    "driscolllipkind691+38h98gp62s@outlook.com",
    "user+ab12cd34@example.com",
    "USER+AB12CD34@EXAMPLE.COM",
    "user+newsletter2026@example.com"
  ])("flags %s", email => {
    expect(hasGeneratedPlusTag(email)).toBe(true);
  });

  it.each([
    ["abcd1234@example.com", "no tag"],
    ["user+@example.com", "empty tag"],
    ["user+ab12cd3@example.com", "seven characters"],
    ["user+newsletter@example.com", "letters only"],
    ["user+20261118@example.com", "digits only"],
    ["user+ab12-cd34@example.com", "punctuation inside the tag"],
    ["user+ab12cd34!@example.com", "punctuation at the end of the tag"],
    ["noatsign+ab12cd345", "no separator"],
    ["@example.com", "empty local part"],
    ["", "empty string"]
  ])("does not flag %s (%s)", email => {
    expect(hasGeneratedPlusTag(email)).toBe(false);
  });

  it("does not flag a missing address", () => {
    expect(hasGeneratedPlusTag(null)).toBe(false);
    expect(hasGeneratedPlusTag(undefined)).toBe(false);
  });
});
