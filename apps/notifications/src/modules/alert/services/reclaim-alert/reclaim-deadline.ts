import { isIanaTimeZone } from "@src/lib/time-zone/time-zone";

const HOUR_MS = 3_600_000;

const UTC = "UTC";

const DEADLINE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "long"
};

/** Shaped like "2026-06-08 16:00 Central European Summer Time", except that UTC keeps its abbreviation. */
function toZonedString(ms: number, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { ...DEADLINE_FORMAT, timeZone }).formatToParts(ms).map(({ type, value }) => [type, value])
  );
  const zoneName = timeZone === UTC ? UTC : parts.timeZoneName;

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${zoneName}`;
}

function toRelative(deadlineMs: number, nowMs: number): string {
  const diffMs = deadlineMs - nowMs;

  if (diffMs <= 0) {
    return "the deadline has passed";
  }

  if (diffMs < HOUR_MS) {
    return "less than an hour from now";
  }

  const hours = Math.round(diffMs / HOUR_MS);
  return `about ${hours} ${hours === 1 ? "hour" : "hours"} from now`;
}

/** Renders a reclamation deadline in the recipient's timezone, or in UTC when it is unknown, plus a relative window. */
export function formatReclaimDeadline(deadlineSeconds: number, nowMs: number, timeZone?: string | null): string {
  const deadlineMs = deadlineSeconds * 1000;
  const zone = timeZone && isIanaTimeZone(timeZone) ? timeZone : UTC;

  return `${toZonedString(deadlineMs, zone)} (${toRelative(deadlineMs, nowMs)})`;
}
