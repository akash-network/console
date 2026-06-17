import { useMemo } from "react";

export type BucketStatus = "online" | "partial" | "offline";

export interface DayBucket {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  status: BucketStatus;
  incidentCount: number;
  downtimeSeconds: number;
  /** True when the provider has an open incident and this is today's bucket; rendered full-height red. */
  isLiveDown: boolean;
}

export interface ProviderUptime {
  percent: number;
  buckets: DayBucket[];
}

interface DailyIncident {
  date: string;
  hasOpenIncident: boolean;
  incidentCount: number;
  downtimeSeconds: number;
}

interface DeriveOptions {
  windowDays?: number;
}

/**
 * Derives 7-day uptime for every provider in one memoized pass, keyed by owner address. `now` and the
 * client's time zone are resolved once per recompute so every provider's day buckets align to the same days.
 */
export function useProvidersUptime(providers: Array<{ owner: string; incidents: DailyIncident[] }>): Map<string, ProviderUptime> {
  return useMemo(() => {
    const now = Date.now();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Map(providers.map(provider => [provider.owner, deriveProviderUptime(provider.incidents, now, timeZone)]));
  }, [providers]);
}

/** Milliseconds in a day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Seconds in a day; the backend clips each day's downtime to this maximum. */
const SECONDS_PER_DAY = 24 * 60 * 60;

/** A day is "offline" by downtime once it covers at least this fraction of the day, otherwise "partial". */
const OFFLINE_FRACTION = 0.5;

/** Per-day incident counts at/above these flag instability independently of total downtime (flapping). */
const FLAPPING_PARTIAL_COUNT = 3;
const FLAPPING_OFFLINE_COUNT = 10;

/** Severity ordering used to combine the downtime and frequency signals into the worse of the two. */
const SEVERITY: Record<BucketStatus, number> = { online: 0, partial: 1, offline: 2 };

/**
 * Derives a provider's 7-day uptime percentage and a per-day health sparkline from the backend's
 * per-day downtime aggregates. The backend only returns days that had an incident, so absent days
 * are healthy. Each day's status is the worse of two signals — how long it was down (downtime) and
 * how often (incident frequency / flapping) — so a low-downtime but high-churn day still reads as
 * unstable. An open incident forces today's bucket into a live-down state. The percentage stays
 * purely downtime-based and is summed over the in-window buckets so it never diverges from the sparkline
 * even if the backend returns out-of-window or duplicate rows. Day buckets align to the client's calendar
 * days in `timeZone` (the zone sent on the request); `now` is injected so the result is deterministic.
 */
export function deriveProviderUptime(incidents: DailyIncident[], now: number, timeZone: string, { windowDays = 7 }: DeriveOptions = {}): ProviderUptime {
  const byDate = new Map(incidents.map(incident => [incident.date, incident]));
  const hasOpenIncident = incidents.some(incident => incident.hasOpenIncident);
  const keys = dayKeysEndingToday(now, timeZone, windowDays);

  const buckets = keys.map((date, index): DayBucket => {
    const row = byDate.get(date);
    const downtimeSeconds = row?.downtimeSeconds ?? 0;
    const incidentCount = row?.incidentCount ?? 0;
    const isLiveDown = index === keys.length - 1 && hasOpenIncident;
    const status = isLiveDown ? "offline" : worstStatus(downtimeStatus(downtimeSeconds), frequencyStatus(incidentCount));
    return { date, status, incidentCount, downtimeSeconds, isLiveDown };
  });

  const totalDowntime = buckets.reduce((sum, bucket) => sum + bucket.downtimeSeconds, 0);
  const percent = 1 - totalDowntime / (windowDays * SECONDS_PER_DAY);

  return { percent, buckets };
}

/** Health implied by how much of the day was down. */
function downtimeStatus(downtimeSeconds: number): BucketStatus {
  const fraction = downtimeSeconds / SECONDS_PER_DAY;
  if (fraction === 0) return "online";
  if (fraction < OFFLINE_FRACTION) return "partial";
  return "offline";
}

/** Health implied by how many separate incidents hit the day (flapping). */
function frequencyStatus(incidentCount: number): BucketStatus {
  if (incidentCount >= FLAPPING_OFFLINE_COUNT) return "offline";
  if (incidentCount >= FLAPPING_PARTIAL_COUNT) return "partial";
  return "online";
}

/** The more severe of two statuses. */
function worstStatus(a: BucketStatus, b: BucketStatus): BucketStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * The `count` calendar days ending today (oldest first) as `YYYY-MM-DD` strings in `timeZone`. Today's
 * date is resolved in the zone, then anchored at noon UTC so stepping back whole days stays DST-safe and
 * matches the backend's `to_char(day, 'YYYY-MM-DD')` keys.
 */
function dayKeysEndingToday(now: number, timeZone: string, count: number): string[] {
  const todayKey = formatDayKey(now, timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const anchorNoonUtc = Date.UTC(year, month - 1, day, 12);

  return Array.from({ length: count }, (_, index) => formatDayKey(anchorNoonUtc - (count - 1 - index) * DAY_MS, "UTC"));
}

/** Formats an instant as a `YYYY-MM-DD` calendar date in the given time zone. */
function formatDayKey(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
