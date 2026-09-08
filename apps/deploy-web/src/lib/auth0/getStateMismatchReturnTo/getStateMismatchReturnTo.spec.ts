import { describe, expect, it } from "vitest";

import { UrlReturnToStack } from "@src/hooks/useReturnTo/UrlReturnToStack";
import { CallbackHandlerError, MissingStateCookieError } from "@src/lib/auth0";
import { getStateMismatchReturnTo } from "./getStateMismatchReturnTo";

describe(getStateMismatchReturnTo.name, () => {
  it("returns the relative return path encoded in the callback state when the transaction cookie holds another state", () => {
    const error = setup({
      cookieReturnTo: "https://console.akash.network/terms-of-service",
      callbackReturnTo: "https://console.akash.network/?_gl=1*abc"
    });

    expect(getStateMismatchReturnTo(error)).toBe("/?_gl=1*abc");
  });

  it("drops a foreign origin from the callback return path", () => {
    const error = setup({
      cookieReturnTo: "https://console.akash.network/",
      callbackReturnTo: "https://evil.example/steal?x=1"
    });

    expect(getStateMismatchReturnTo(error)).toBe("/steal?x=1");
  });

  it("returns the root path when the callback state cannot be decoded", () => {
    const error = new CallbackHandlerError(
      stateMismatchCause({ checks: { state: encodeState({ returnTo: "https://console.akash.network/" }) }, params: { state: "not-base64-json" } })
    );

    expect(getStateMismatchReturnTo(error)).toBe("/");
  });

  it("keeps a nested return stack recoverable once pushed onto the login url", () => {
    const error = setup({
      cookieReturnTo: "https://console.akash.network/terms-of-service",
      callbackReturnTo: "https://console.akash.network/deployments?returnTo=%2Fonboarding"
    });
    const recovered = getStateMismatchReturnTo(error) as string;

    const loginUrl = UrlReturnToStack.createReturnable(recovered, "/login?error=provider_login_failed");

    expect(UrlReturnToStack.getReturnTo(loginUrl)).toBe(recovered);
  });

  it("returns undefined when both states match", () => {
    const state = encodeState({ returnTo: "https://console.akash.network/" });

    expect(getStateMismatchReturnTo(new CallbackHandlerError(stateMismatchCause({ checks: { state }, params: { state } })))).toBeUndefined();
  });

  it("returns undefined for a callback handler error with another cause", () => {
    expect(getStateMismatchReturnTo(new CallbackHandlerError(new MissingStateCookieError()))).toBeUndefined();
  });

  it("returns undefined for non-auth errors", () => {
    expect(getStateMismatchReturnTo(new Error("state mismatch, expected a, got: b"))).toBeUndefined();
    expect(getStateMismatchReturnTo(undefined)).toBeUndefined();
  });

  function setup(input: { cookieReturnTo: string; callbackReturnTo: string }) {
    return new CallbackHandlerError(
      stateMismatchCause({
        checks: { state: encodeState({ returnTo: input.cookieReturnTo }) },
        params: { state: encodeState({ returnTo: input.callbackReturnTo }) }
      })
    );
  }

  function stateMismatchCause(input: { checks: { state: string }; params: { state: string } }) {
    return Object.assign(new Error(`state mismatch, expected ${input.checks.state}, got: ${input.params.state}`), input);
  }

  function encodeState(state: { returnTo: string }) {
    return Buffer.from(JSON.stringify(state)).toString("base64url");
  }
});
