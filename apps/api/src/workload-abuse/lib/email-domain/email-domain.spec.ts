import { describe, expect, it } from "vitest";

import { extractEmailDomain, normalizeEmailDomain } from "./email-domain";

describe("extractEmailDomain", () => {
  it.each([
    ["user@example.com", "example.com"],
    ["  user@example.com  ", "example.com"],
    ["User@Example.COM", "example.com"],
    ["user@example.com.", "example.com"],
    ["user+tag@example.com", "example.com"],
    ['"user@internal"@example.com', "example.com"],
    ["user@mail.example.co.uk", "mail.example.co.uk"],
    [`user@${"a".repeat(249)}.com`, `${"a".repeat(249)}.com`]
  ])("extracts %s as %s", (email, expected) => {
    expect(extractEmailDomain(email)).toBe(expected);
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["noatsign", "no separator"],
    ["@example.com", "empty local part"],
    ["user@", "empty domain"],
    ["user@example.com..", "two trailing dots"],
    ["user@localhost", "no dot"],
    ["user@[192.168.0.1]", "address literal"],
    ["user@-example.com", "leading hyphen"],
    ["user@example-.com", "trailing hyphen"],
    ["user@exa mple.com", "embedded space"],
    ["user@exam_ple.com", "underscore"],
    [`user@${"a".repeat(250)}.com`, "over the length limit"]
  ])("returns null for %s (%s)", email => {
    expect(extractEmailDomain(email)).toBeNull();
  });

  it.each([[null], [undefined]])("returns null for %s", email => {
    expect(extractEmailDomain(email)).toBeNull();
  });
});

describe("normalizeEmailDomain", () => {
  it.each([
    ["Example.COM", "example.com"],
    [" example.com ", "example.com"],
    ["example.com.", "example.com"]
  ])("normalizes %s to %s", (domain, expected) => {
    expect(normalizeEmailDomain(domain)).toBe(expected);
  });

  it.each([[""], ["localhost"], ["exa mple.com"], [null], [undefined]])("returns null for %s", domain => {
    expect(normalizeEmailDomain(domain)).toBeNull();
  });
});
