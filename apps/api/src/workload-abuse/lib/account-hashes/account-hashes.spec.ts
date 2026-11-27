import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashAccount, hashBrowser, hashFingerprint } from "./account-hashes";

const SECRET = "a".repeat(32);

describe(hashAccount.name, () => {
  it("hashes the identity and the normalized email under the secret, each for its own purpose", () => {
    expect(hashAccount(SECRET, { userId: "auth0|abc123", email: "  Jane.Doe+trial@Example.COM " })).toEqual({
      identityHash: keyedHash(SECRET, "deleted-account-identity:auth0|abc123"),
      emailHash: keyedHash(SECRET, "deleted-account-email:jane.doe@example.com")
    });
  });

  it("hashes the same account differently under another secret", () => {
    const account = { userId: "auth0|abc123", email: "jane@example.com" };
    const otherSecret = "b".repeat(32);

    expect(hashAccount(otherSecret, account)).toEqual({
      identityHash: keyedHash(otherSecret, "deleted-account-identity:auth0|abc123"),
      emailHash: keyedHash(otherSecret, "deleted-account-email:jane@example.com")
    });
    expect(hashAccount(otherSecret, account)).not.toEqual(hashAccount(SECRET, account));
  });

  it("leaves out the hash of an identity or an email the account does not have", () => {
    expect(hashAccount(SECRET, { userId: null, email: "jane@example.com" }).identityHash).toBeNull();
    expect(hashAccount(SECRET, { userId: "auth0|abc123", email: "not-an-address" }).emailHash).toBeNull();
    expect(hashAccount(SECRET, { userId: null, email: null })).toEqual({ identityHash: null, emailHash: null });
  });
});

describe(hashFingerprint.name, () => {
  it("hashes the fingerprint under the secret for its own purpose", () => {
    expect(hashFingerprint(SECRET, "f00d")).toBe(keyedHash(SECRET, "deleted-account-fingerprint:f00d"));
    expect(hashFingerprint("b".repeat(32), "f00d")).toBe(keyedHash("b".repeat(32), "deleted-account-fingerprint:f00d"));
  });

  it("leaves out the hash of a fingerprint the account does not have", () => {
    expect(hashFingerprint(SECRET, null)).toBeNull();
    expect(hashFingerprint(SECRET, "")).toBeNull();
  });
});

describe(hashBrowser.name, () => {
  const browser = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 Chrome/142.0" };

  it("hashes the address and the user agent under the secret, for a purpose of its own", () => {
    expect(hashBrowser(SECRET, browser)).toBe(keyedHash(SECRET, "refused-signup-browser:203.0.113.7 Mozilla/5.0 Chrome/142.0"));
    expect(hashBrowser("b".repeat(32), browser)).not.toBe(hashBrowser(SECRET, browser));
  });

  it("hashes a user agent longer than an account stores like the stored one", () => {
    const stored = "a".repeat(500);

    expect(hashBrowser(SECRET, { ip: browser.ip, userAgent: `${stored}tail` })).toBe(hashBrowser(SECRET, { ip: browser.ip, userAgent: stored }));
    expect(hashBrowser(SECRET, { ip: browser.ip, userAgent: stored })).not.toBe(hashBrowser(SECRET, { ip: browser.ip, userAgent: "a".repeat(499) }));
  });

  it("tells apart browsers that differ in either part", () => {
    expect(hashBrowser(SECRET, { ...browser, ip: "203.0.113.8" })).not.toBe(hashBrowser(SECRET, browser));
    expect(hashBrowser(SECRET, { ...browser, userAgent: "curl/8.7" })).not.toBe(hashBrowser(SECRET, browser));
  });

  it.each([
    { ip: null, userAgent: "Mozilla/5.0" },
    { ip: undefined, userAgent: "Mozilla/5.0" },
    { ip: "", userAgent: "Mozilla/5.0" },
    { ip: "203.0.113.7", userAgent: null },
    { ip: "203.0.113.7", userAgent: undefined },
    { ip: "203.0.113.7", userAgent: "" }
  ])("returns null for %o", incomplete => {
    expect(hashBrowser(SECRET, incomplete)).toBeNull();
  });
});

function keyedHash(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
