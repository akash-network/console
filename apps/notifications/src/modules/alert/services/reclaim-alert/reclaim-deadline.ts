const HOUR_MS = 3_600_000;

function toUtcString(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
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

/**
 * Renders a reclamation deadline as an absolute UTC timestamp plus a relative
 * window, e.g. `2026-06-08 14:00 UTC (about 71 hours from now)`. The tenant's
 * timezone is unknown server-side, so the absolute time is always UTC.
 *
 * @param deadlineSeconds - unix timestamp (seconds) when the reclamation window expires
 * @param nowMs - current time in milliseconds (injected for deterministic formatting)
 */
export function formatReclaimDeadline(deadlineSeconds: number, nowMs: number): string {
  const deadlineMs = deadlineSeconds * 1000;
  return `${toUtcString(deadlineMs)} (${toRelative(deadlineMs, nowMs)})`;
}
