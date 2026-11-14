import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { EmailSignInFailureReason } from "./emailSignInFailure";
import { emailSignInFailureReasonOf, trackEmailSignInFailure } from "./emailSignInFailure";

describe(emailSignInFailureReasonOf.name, () => {
  it.each<[string, EmailSignInFailureReason]>([
    ["action_refused", "refused_by_policy"],
    ["invalid_email", "invalid_email"],
    ["rate_limited", "rate_limited"],
    ["invalid_code", "wrong_code"],
    ["expired_code", "expired_code"]
  ])("reads the %s error code as %s", (code, reason) => {
    expect(emailSignInFailureReasonOf(httpError({ status: 400, data: { code } }))).toBe(reason);
  });

  it("reads an error code it does not know as other", () => {
    expect(emailSignInFailureReasonOf(httpError({ status: 400, data: { code: "captcha_verification_failed" } }))).toBe("other");
  });

  it("reads a refused request that carries no error code as other", () => {
    expect(emailSignInFailureReasonOf(httpError({ status: 400, data: { errors: [] } }))).toBe("other");
  });

  it("reads a 429 that carries no error code as rate_limited", () => {
    expect(emailSignInFailureReasonOf(httpError({ status: 429, data: "Too many requests" }))).toBe("rate_limited");
  });

  it("reads a response without a body as other", () => {
    expect(emailSignInFailureReasonOf(httpError({ status: 502, data: null }))).toBe("other");
  });

  it("reads a request that got no response as other", () => {
    expect(emailSignInFailureReasonOf(new AxiosError("Network Error"))).toBe("other");
  });

  it("reads an error that did not come from the request as other", () => {
    expect(emailSignInFailureReasonOf(Object.assign(new Error("Boom"), { response: { status: 429, data: { code: "invalid_code" } } }))).toBe("other");
  });
});

describe(trackEmailSignInFailure.name, () => {
  it("tracks the failed step with its reason and nothing else", () => {
    const analyticsService = mock<AnalyticsService>();

    trackEmailSignInFailure(
      analyticsService,
      "verify_code",
      httpError({ status: 400, data: { code: "invalid_code", message: "Wrong email or verification code." } })
    );

    expect(analyticsService.track).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("email_login_failed", { category: "user", step: "verify_code", reason: "wrong_code" });
  });

  it("tracks nothing when the captcha was not solved", () => {
    const analyticsService = mock<AnalyticsService>();

    trackEmailSignInFailure(analyticsService, "send_code", new CaptchaChallengeError("abandoned"));

    expect(analyticsService.track).not.toHaveBeenCalled();
  });
});

function httpError(response: { status: number; data: unknown }) {
  return new AxiosError("Request failed", String(response.status), undefined, undefined, {
    status: response.status,
    statusText: "Request failed",
    data: response.data,
    headers: {},
    config: mock<InternalAxiosRequestConfig>()
  });
}
