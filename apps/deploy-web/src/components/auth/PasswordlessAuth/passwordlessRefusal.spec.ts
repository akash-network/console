import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";
import { isPasswordlessRefusal, SKIP_REPORTING_PASSWORDLESS_OUTCOME } from "./passwordlessRefusal";

describe(isPasswordlessRefusal.name, () => {
  it.each([
    [400, "invalid_email"],
    [400, "invalid_code"],
    [400, "action_refused"],
    [429, "rate_limited"]
  ])("is true for a %s answering %s", (status, code) => {
    expect(isPasswordlessRefusal(httpError(status, { code, message: "Refused" }))).toBe(true);
  });

  it("is false for an Auth0 failure the route could not classify", () => {
    expect(isPasswordlessRefusal(httpError(400, { code: "unknown", message: "Unable to send code." }))).toBe(false);
  });

  it("is false for a captcha the server failed to verify", () => {
    expect(isPasswordlessRefusal(httpError(400, { code: "captcha_verification_failed" }))).toBe(false);
  });

  it.each([
    ["a body with a non-string code", { code: 400 }],
    ["a body that is not an object", "Bad Request"],
    ["no body", undefined]
  ])("is false for %s", (_name, data) => {
    expect(isPasswordlessRefusal(httpError(400, data))).toBe(false);
  });

  it("is false when there is no response at all", () => {
    expect(isPasswordlessRefusal(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(false);
  });

  it("is false for a non-http error carrying a refusal code", () => {
    expect(isPasswordlessRefusal(Object.assign(new Error("boom"), { response: { data: { code: "action_refused" } } }))).toBe(false);
  });
});

describe("SKIP_REPORTING_PASSWORDLESS_OUTCOME", () => {
  it("skips a captcha challenge the user never solved", () => {
    expect(SKIP_REPORTING_PASSWORDLESS_OUTCOME.skipErrorReporting(new CaptchaChallengeError("abandoned"))).toBe(true);
  });

  it("skips a refusal of the user's own input", () => {
    expect(SKIP_REPORTING_PASSWORDLESS_OUTCOME.skipErrorReporting(httpError(400, { code: "action_refused" }))).toBe(true);
  });

  it("reports an Auth0 failure the route could not classify", () => {
    expect(SKIP_REPORTING_PASSWORDLESS_OUTCOME.skipErrorReporting(httpError(400, { code: "unknown" }))).toBe(false);
  });

  it("reports a server error", () => {
    expect(SKIP_REPORTING_PASSWORDLESS_OUTCOME.skipErrorReporting(httpError(500, undefined))).toBe(false);
  });
});

function httpError(status: number, data: unknown) {
  return new AxiosError("Request failed", String(status), undefined, undefined, { status, data } as never);
}
