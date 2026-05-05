import { describe, expect, it } from "vitest";

import { AccessTokenError, AccessTokenErrorCode } from "@src/lib/auth0";
import { isInvalidSessionError } from "./isInvalidSessionError";

describe("isInvalidSessionError", () => {
  it("returns true for AccessTokenError with EXPIRED_ACCESS_TOKEN", () => {
    const error = new AccessTokenError(AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN, "expired");
    expect(isInvalidSessionError(error)).toBe(true);
  });

  it("returns true for AccessTokenError with FAILED_REFRESH_GRANT", () => {
    const error = new AccessTokenError(AccessTokenErrorCode.FAILED_REFRESH_GRANT, "refresh failed");
    expect(isInvalidSessionError(error)).toBe(true);
  });

  it("returns false for AccessTokenError with other codes", () => {
    const error = new AccessTokenError(AccessTokenErrorCode.MISSING_SESSION, "no session");
    expect(isInvalidSessionError(error)).toBe(false);
  });

  it("returns false for non-AccessTokenError instances", () => {
    expect(isInvalidSessionError(new Error("boom"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isInvalidSessionError(null)).toBe(false);
    expect(isInvalidSessionError(undefined)).toBe(false);
  });
});
