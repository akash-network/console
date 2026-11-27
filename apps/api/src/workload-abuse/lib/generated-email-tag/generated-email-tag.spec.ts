import { describe, expect, it } from "vitest";

import { hasGeneratedPlusTag } from "./generated-email-tag";

describe(hasGeneratedPlusTag.name, () => {
  it.each([
    "veliarothmann5510+y177lq10ru@hotmail.com",
    "driscolllipkind691+38h98gp62s@outlook.com",
    "user+ab12cd34@example.com",
    "USER+AB12CD34@EXAMPLE.COM",
    "user+newsletter2026@example.com"
  ])("flags %s, whose tag of eight or more characters mixes letters and digits", email => {
    expect(hasGeneratedPlusTag(email)).toBe(true);
  });

  it.each([
    ["user+xkqzt@outlook.com", "five random letters"],
    ["user+XKQZT@outlook.com", "five random letters in upper case"],
    ["user+qwmzr@outlook.com", "five random letters"],
    ["user+zxcvb@outlook.com", "a keyboard row"],
    ["user+bvntejk@outlook.com", "seven random letters"],
    ["user+hjqkvbnmpl@outlook.com", "ten random letters"],
    ["user+a3k9x@outlook.com", "five characters with digits between the letters"],
    ["user+7hq2z@outlook.com", "five characters starting with a digit"],
    ["user+k2m4p@outlook.com", "five characters alternating letters and digits"],
    ["user+xkqz7@outlook.com", "four random letters before a number"],
    ["user+ab1cd@outlook.com", "a digit inside the letters"],
    ["user+ab12cd3@example.com", "seven characters with digits inside the letters"],
    ["user+console1@outlook.com", "an eight character word and number"]
  ])("flags %s (%s)", email => {
    expect(hasGeneratedPlusTag(email)).toBe(true);
  });

  it.each([
    ["user+akash@outlook.com", "a five letter word"],
    ["user+AKASH@outlook.com", "a word in upper case"],
    ["user+promo@outlook.com", "a five letter word"],
    ["user+console@outlook.com", "a seven letter word"],
    ["user+newsletter@example.com", "a long word"],
    ["user+project@example.com", "a word with an uncommon letter pair"],
    ["user+test1@outlook.com", "a word before a number"],
    ["user+akash2@outlook.com", "a word before a number"],
    ["user+news24@outlook.com", "a word before a two digit number"],
    ["user+gpu01@outlook.com", "an acronym before a number"],
    ["user+xk421@outlook.com", "two letters before a number"],
    ["user+news@outlook.com", "four letters"],
    ["user+xkqz@outlook.com", "four random letters"],
    ["user+a3k9@outlook.com", "four characters"],
    ["user+signup1@outlook.com", "a seven character word and number"],
    ["user+xkq42@outlook.com", "three letters before a number"],
    ["abcd1234@example.com", "no tag"],
    ["user+@example.com", "empty tag"],
    ["user+20261118@example.com", "digits only"],
    ["user+ab12-cd34@example.com", "punctuation inside the tag"],
    ["user+ab12cd34!@example.com", "punctuation at the end of the tag"],
    ["user+xkqzt.@outlook.com", "punctuation after random letters"],
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
