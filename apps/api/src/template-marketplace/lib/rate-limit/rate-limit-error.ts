import createError from "http-errors";

export const TEMPLATE_RATE_LIMITED_ERROR_CODE = "template_rate_limited";

export type RateLimitRefusal = {
  /** What the limit counts, as a plural the message can follow a number with: `templates`, `versions`. */
  counted: string;
  /** Whose limit was reached. */
  scope: "user" | "organization";
  max: number;
  windowSeconds: number;
  retryAfterSeconds: number;
};

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

const UNITS: ReadonlyArray<[number, string]> = [
  [DAY_SECONDS, "day"],
  [HOUR_SECONDS, "hour"],
  [MINUTE_SECONDS, "minute"]
];

type Duration = { count: number; unit: string };

/** Rounds up to the largest unit that fits, so the wait named is never shorter than the real one. */
function toDuration(seconds: number): Duration {
  const [unitSeconds, unit] = UNITS.find(([size]) => seconds >= size) ?? [1, "second"];

  return { count: Math.ceil(seconds / unitSeconds), unit };
}

export function describeWait(seconds: number): string {
  const { count, unit } = toDuration(seconds);

  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

export function describeWindow(seconds: number): string {
  const { count, unit } = toDuration(seconds);

  return count === 1 ? unit : `${count} ${unit}s`;
}

export function createRateLimitError(action: string, refusal: RateLimitRefusal) {
  const { counted, scope, max, windowSeconds, retryAfterSeconds } = refusal;
  const subject = scope === "organization" ? "Your organization" : "You";
  const message = `${subject} reached the limit of ${max} ${counted} per ${describeWindow(windowSeconds)}. Try again in ${describeWait(retryAfterSeconds)}.`;

  return createError(429, message, {
    errorCode: TEMPLATE_RATE_LIMITED_ERROR_CODE,
    headers: { "Retry-After": String(retryAfterSeconds) },
    data: { action, scope, limit: max, windowSeconds, retryAfterSeconds }
  });
}

/** The refusal that lifts last is the one to report, since retrying before it would be refused again. */
export function findLastingRefusal(refusals: RateLimitRefusal[]): RateLimitRefusal | undefined {
  return refusals.reduce<RateLimitRefusal | undefined>(
    (lasting, refusal) => (!lasting || refusal.retryAfterSeconds > lasting.retryAfterSeconds ? refusal : lasting),
    undefined
  );
}
