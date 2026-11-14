import { isHttpError } from "@akashnetwork/http-sdk";

import { CaptchaChallengeError } from "@src/components/turnstile/CaptchaChallengeError";

/** Refusals the passwordless routes answer for the user's own input, which the form shows them; `unknown` stays reported as an Auth0 fault. */
const USER_FACING_REFUSAL_CODES: unknown[] = ["invalid_email", "invalid_code", "action_refused", "rate_limited"];

export function isPasswordlessRefusal(error: unknown): boolean {
  if (!isHttpError(error)) return false;

  const code = (error.response?.data as { code?: unknown } | undefined)?.code;
  return USER_FACING_REFUSAL_CODES.includes(code);
}

export const SKIP_REPORTING_PASSWORDLESS_OUTCOME = {
  skipErrorReporting: (error: unknown) => error instanceof CaptchaChallengeError || isPasswordlessRefusal(error)
};
