import { describe, expect, it } from "vitest";

import { normalizeReferralCode, readReferralCode, readSignUpReferralCode, REFERRAL_COOKIE_NAME } from "./referral-cookie";

describe(normalizeReferralCode.name, () => {
  it("lowercases and trims a valid code", () => {
    expect(normalizeReferralCode(" Creator ")).toBe("creator");
  });

  it("rejects a code containing a space", () => {
    expect(normalizeReferralCode("bad space")).toBeUndefined();
  });

  it("rejects a code shorter than 3 characters", () => {
    expect(normalizeReferralCode("ab")).toBeUndefined();
  });

  it("rejects a code longer than 32 characters", () => {
    expect(normalizeReferralCode("a".repeat(33))).toBeUndefined();
  });

  it("accepts a code at the 32 character boundary", () => {
    expect(normalizeReferralCode("a".repeat(32))).toBe("a".repeat(32));
  });

  it("rejects a code starting with a hyphen", () => {
    expect(normalizeReferralCode("-creator")).toBeUndefined();
  });

  it("rejects a code ending with a hyphen", () => {
    expect(normalizeReferralCode("creator-")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizeReferralCode(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeReferralCode(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(normalizeReferralCode("")).toBeUndefined();
  });
});

describe(readReferralCode.name, () => {
  it("normalizes the cookie value when present", () => {
    expect(readReferralCode({ [REFERRAL_COOKIE_NAME]: "Creator" })).toBe("creator");
  });

  it("returns undefined when the cookie is absent", () => {
    expect(readReferralCode({})).toBeUndefined();
  });

  it("returns undefined when the cookie value is invalid", () => {
    expect(readReferralCode({ [REFERRAL_COOKIE_NAME]: "bad space" })).toBeUndefined();
  });
});

describe(readSignUpReferralCode.name, () => {
  it("prefers the code on the link over the stored cookie", () => {
    expect(readSignUpReferralCode("NewCode", { [REFERRAL_COOKIE_NAME]: "oldcode" })).toBe("newcode");
  });

  it("reads the first code when the link repeats the parameter", () => {
    expect(readSignUpReferralCode(["first", "second"], {})).toBe("first");
  });

  it("falls back to the stored cookie when the link has no valid code", () => {
    expect(readSignUpReferralCode("bad space", { [REFERRAL_COOKIE_NAME]: "oldcode" })).toBe("oldcode");
  });

  it("returns undefined when neither the link nor the cookie has a code", () => {
    expect(readSignUpReferralCode(undefined, {})).toBeUndefined();
  });
});
