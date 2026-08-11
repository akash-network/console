import { describe, expect, it } from "vitest";

import { isAccessTokenExpired } from "./isAccessTokenExpired";

const NOW_SECONDS = Math.floor(Date.now() / 1_000);

describe(isAccessTokenExpired.name, () => {
  it("returns false when the access token expires in the future", () => {
    expect(isAccessTokenExpired({ accessTokenExpiresAt: NOW_SECONDS + 3_600 })).toBe(false);
  });

  it("returns true when the access token has already expired", () => {
    expect(isAccessTokenExpired({ accessTokenExpiresAt: NOW_SECONDS - 60 })).toBe(true);
  });

  it("treats a missing expiry as expired", () => {
    expect(isAccessTokenExpired({})).toBe(true);
  });

  it("treats a null session as expired", () => {
    expect(isAccessTokenExpired(null)).toBe(true);
  });
});
