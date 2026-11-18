import { describe, expect, it } from "vitest";

import { createRateLimitError, describeWait, describeWindow, findLastingRefusal, type RateLimitRefusal } from "./rate-limit-error";

describe(describeWait.name, () => {
  it.each([
    { seconds: 1, wait: "1 second" },
    { seconds: 59, wait: "59 seconds" },
    { seconds: 60, wait: "1 minute" },
    { seconds: 61, wait: "2 minutes" },
    { seconds: 3599, wait: "60 minutes" },
    { seconds: 3600, wait: "1 hour" },
    { seconds: 3601, wait: "2 hours" },
    { seconds: 86399, wait: "24 hours" },
    { seconds: 86400, wait: "1 day" },
    { seconds: 86401, wait: "2 days" }
  ])("rounds $seconds seconds up to $wait", ({ seconds, wait }) => {
    expect(describeWait(seconds)).toBe(wait);
  });
});

describe(describeWindow.name, () => {
  it.each([
    { seconds: 3600, window: "hour" },
    { seconds: 86400, window: "day" },
    { seconds: 60, window: "minute" },
    { seconds: 1, window: "second" },
    { seconds: 7200, window: "2 hours" },
    { seconds: 900, window: "15 minutes" }
  ])("names a window of $seconds seconds as $window", ({ seconds, window }) => {
    expect(describeWindow(seconds)).toBe(window);
  });
});

describe(createRateLimitError.name, () => {
  it("tells a user which limit they reached and when to try again", () => {
    const error = createRateLimitError(
      "create",
      createRefusal({ scope: "user", counted: "new templates", max: 20, windowSeconds: 3600, retryAfterSeconds: 700 })
    );

    expect(error).toMatchObject({
      status: 429,
      message: "You reached the limit of 20 new templates per hour. Try again in 12 minutes.",
      errorCode: "template_rate_limited",
      headers: { "Retry-After": "700" },
      data: { action: "create", scope: "user", limit: 20, windowSeconds: 3600, retryAfterSeconds: 700 }
    });
  });

  it("names the organization when its limit is the one reached", () => {
    const error = createRateLimitError(
      "publish",
      createRefusal({ scope: "organization", counted: "published templates", max: 30, windowSeconds: 86400, retryAfterSeconds: 7200 })
    );

    expect(error.message).toBe("Your organization reached the limit of 30 published templates per day. Try again in 2 hours.");
    expect(error.data).toMatchObject({ action: "publish", scope: "organization" });
  });
});

describe(findLastingRefusal.name, () => {
  it("answers nothing without a refusal", () => {
    expect(findLastingRefusal([])).toBeUndefined();
  });

  it("answers the refusal that lifts last wherever it stands", () => {
    const sooner = createRefusal({ scope: "user", retryAfterSeconds: 60 });
    const later = createRefusal({ scope: "organization", retryAfterSeconds: 600 });

    expect(findLastingRefusal([sooner, later])).toBe(later);
    expect(findLastingRefusal([later, sooner])).toBe(later);
  });

  it("keeps the first of two refusals that lift together", () => {
    const first = createRefusal({ scope: "user", retryAfterSeconds: 60 });
    const second = createRefusal({ scope: "organization", retryAfterSeconds: 60 });

    expect(findLastingRefusal([first, second])).toBe(first);
  });
});

function createRefusal(overrides: Partial<RateLimitRefusal>): RateLimitRefusal {
  return { counted: "new templates", scope: "user", max: 20, windowSeconds: 3600, retryAfterSeconds: 60, ...overrides };
}
