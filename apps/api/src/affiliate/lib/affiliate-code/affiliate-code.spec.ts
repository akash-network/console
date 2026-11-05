import { describe, expect, it } from "vitest";

import { generateAffiliateCode, normalizeAffiliateCode } from "./affiliate-code";

describe(normalizeAffiliateCode.name, () => {
  it("lowercases and trims a valid code", () => {
    expect(normalizeAffiliateCode("  Creator-1 ")).toBe("creator-1");
  });

  it("accepts a code at the minimum length of 3", () => {
    expect(normalizeAffiliateCode("a1b")).toBe("a1b");
  });

  it("accepts a code at the maximum length of 32", () => {
    const code = `a${"b".repeat(30)}c`;

    expect(normalizeAffiliateCode(code)).toBe(code);
  });

  it.each(["a", "-ab", "ab-", "has space", "a".repeat(33), "Ab!c", ""])("rejects %j", raw => {
    expect(normalizeAffiliateCode(raw)).toBeUndefined();
  });
});

describe(generateAffiliateCode.name, () => {
  it("generates an 8-character lowercase alphanumeric code", () => {
    expect(generateAffiliateCode()).toMatch(/^[a-z0-9]{8}$/);
  });

  it("generates different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAffiliateCode()));

    expect(codes.size).toBeGreaterThan(1);
  });
});
