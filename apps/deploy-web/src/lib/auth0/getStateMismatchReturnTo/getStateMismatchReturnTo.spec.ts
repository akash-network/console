import { describe, expect, it } from "vitest";

import { UrlReturnToStack } from "@src/hooks/useReturnTo/UrlReturnToStack";
import { CallbackHandlerError, MissingStateCookieError } from "@src/lib/auth0";
import { getStateMismatchReturnTo } from "./getStateMismatchReturnTo";

describe(getStateMismatchReturnTo.name, () => {
  it("returns the return path encoded in the callback state when the transaction cookie holds another state", () => {
    const error = setup({
      cookieState: encodeState("https://console.akash.network/terms-of-service"),
      callbackState: encodeState("https://console.akash.network/?_gl=1*18a3tmt")
    });

    expect(getStateMismatchReturnTo(error)).toBe("/?_gl=1*18a3tmt");
  });

  it("drops a foreign origin from the callback return path", () => {
    const error = setup({ cookieState: encodeState("https://console.akash.network/"), callbackState: encodeState("https://evil.example/steal?x=1") });

    expect(getStateMismatchReturnTo(error)).toBe("/steal?x=1");
  });

  it("keeps a callback return path that is already relative", () => {
    const error = setup({ cookieState: encodeState("/terms-of-service"), callbackState: encodeState("/deployments?tab=EVENTS") });

    expect(getStateMismatchReturnTo(error)).toBe("/deployments?tab=EVENTS");
  });

  it("keeps a nested return stack recoverable once pushed onto the login url", () => {
    const error = setup({ cookieState: encodeState("/terms-of-service"), callbackState: encodeState("/deployments?returnTo=%2Fonboarding") });
    const recovered = getStateMismatchReturnTo(error) as string;

    const loginUrl = UrlReturnToStack.createReturnable(recovered, "/login?error=provider_login_failed");

    expect(UrlReturnToStack.getReturnTo(loginUrl)).toBe(recovered);
  });

  it("returns the root path when the callback state cannot be decoded", () => {
    const error = setup({ cookieState: encodeState("/terms-of-service"), callbackState: "not-base64-json" });

    expect(getStateMismatchReturnTo(error)).toBe("/");
  });

  it("returns the root path when the callback state carries no return url", () => {
    const error = setup({ cookieState: encodeState("/terms-of-service"), callbackState: Buffer.from("{}").toString("base64url") });

    expect(getStateMismatchReturnTo(error)).toBe("/");
  });

  it("returns undefined when both states match", () => {
    const state = encodeState("https://console.akash.network/");

    expect(getStateMismatchReturnTo(setup({ cookieState: state, callbackState: state }))).toBeUndefined();
  });

  it("returns undefined when only the transaction cookie carries a state", () => {
    expect(getStateMismatchReturnTo(setup({ cookieState: encodeState("/terms-of-service") }))).toBeUndefined();
  });

  it("returns undefined when only the callback carries a state", () => {
    expect(getStateMismatchReturnTo(setup({ callbackState: encodeState("/terms-of-service") }))).toBeUndefined();
  });

  it("returns undefined for a callback handler error with another cause", () => {
    expect(getStateMismatchReturnTo(new CallbackHandlerError(new MissingStateCookieError()))).toBeUndefined();
  });

  it("returns undefined for non-auth errors", () => {
    expect(getStateMismatchReturnTo(new Error("state mismatch, expected a, got: b"))).toBeUndefined();
    expect(getStateMismatchReturnTo(undefined)).toBeUndefined();
  });

  function setup(input: { cookieState?: string; callbackState?: string }) {
    return new CallbackHandlerError(
      Object.assign(new Error("state mismatch"), {
        ...(input.cookieState ? { checks: { state: input.cookieState } } : {}),
        ...(input.callbackState ? { params: { state: input.callbackState } } : {})
      })
    );
  }

  function encodeState(returnTo: string) {
    return Buffer.from(JSON.stringify({ returnTo })).toString("base64url");
  }
});
