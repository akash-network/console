import { isHttpError } from "@akashnetwork/http-sdk";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";

export type EmailSignInStep = "send_code" | "resend_code" | "verify_code";

export type EmailSignInFailureReason = "refused_by_policy" | "invalid_email" | "rate_limited" | "wrong_code" | "expired_code" | "other";

const REASON_BY_ERROR_CODE = new Map<string, EmailSignInFailureReason>([
  ["action_refused", "refused_by_policy"],
  ["invalid_email", "invalid_email"],
  ["rate_limited", "rate_limited"],
  ["invalid_code", "wrong_code"],
  ["expired_code", "expired_code"]
]);

const TOO_MANY_REQUESTS_STATUS = 429;

export function emailSignInFailureReasonOf(error: unknown): EmailSignInFailureReason {
  if (!isHttpError<{ code?: string }>(error)) return "other";

  const reason = REASON_BY_ERROR_CODE.get(error.response?.data?.code ?? "");
  if (reason) return reason;

  return error.response?.status === TOO_MANY_REQUESTS_STATUS ? "rate_limited" : "other";
}

/** Sends the step and the reason category only, so the address, its domain and the code never reach analytics. */
export function trackEmailSignInFailure(analyticsService: Pick<AnalyticsService, "track">, step: EmailSignInStep, error: unknown) {
  if (error instanceof CaptchaChallengeError) return;

  analyticsService.track("email_login_failed", { category: "user", step, reason: emailSignInFailureReasonOf(error) });
}
