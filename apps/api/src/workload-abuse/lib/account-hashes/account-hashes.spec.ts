import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashAccount } from "./account-hashes";

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

  function keyedHash(secret: string, value: string) {
    return createHmac("sha256", secret).update(value).digest("hex");
  }
});
