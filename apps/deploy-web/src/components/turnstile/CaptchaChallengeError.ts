export type CaptchaChallengeReason = "abandoned" | "timeout" | "dismissed" | "error";

const MESSAGES: Record<CaptchaChallengeReason, string> = {
  abandoned: "Verification wasn't completed. Please try again.",
  timeout: "Verification didn't finish in time. Please try again.",
  dismissed: "Verification was cancelled.",
  error: "Verification failed. Please try again."
};

export class CaptchaChallengeError extends Error {
  readonly name = "CaptchaChallengeError";

  constructor(
    readonly reason: CaptchaChallengeReason,
    readonly code?: string
  ) {
    super(MESSAGES[reason]);
  }
}

/**
 * The widget reports its own anomalies with tags the global cache handler cannot know, and a challenge the visitor
 * simply never solved is not a fault at all, so neither shape should reach Sentry a second time from a mutation.
 */
export const SKIP_REPORTING_CAPTCHA_OUTCOME = { skipErrorReporting: (error: unknown) => error instanceof CaptchaChallengeError };
