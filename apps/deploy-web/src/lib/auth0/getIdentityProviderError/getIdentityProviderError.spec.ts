import { describe, expect, it } from "vitest";

import { CallbackHandlerError, IdentityProviderError, MissingStateCookieError } from "@src/lib/auth0";
import { getIdentityProviderError } from "./getIdentityProviderError";

describe(getIdentityProviderError.name, () => {
  it("returns the identity provider error wrapped by a callback handler error", () => {
    const cause = new IdentityProviderError({
      message: "invalid_request (InternalOAuthError: failed to fetch user profile)",
      error: "invalid_request",
      error_description: "InternalOAuthError: failed to fetch user profile"
    });

    const result = getIdentityProviderError(new CallbackHandlerError(cause));

    expect(result).toBe(cause);
    expect(result?.error).toBe("invalid_request");
  });

  it("returns undefined for a callback handler error with another cause", () => {
    expect(getIdentityProviderError(new CallbackHandlerError(new MissingStateCookieError()))).toBeUndefined();
  });

  it("returns undefined for a bare identity provider error", () => {
    const error = new IdentityProviderError({ message: "access_denied", error: "access_denied", error_description: "denied" });
    expect(getIdentityProviderError(error)).toBeUndefined();
  });

  it("returns undefined for non-auth errors", () => {
    expect(getIdentityProviderError(new Error("boom"))).toBeUndefined();
    expect(getIdentityProviderError(undefined)).toBeUndefined();
  });
});
