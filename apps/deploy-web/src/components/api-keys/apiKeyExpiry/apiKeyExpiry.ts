import { addDays, differenceInCalendarDays, isAfter } from "date-fns";

export const MIN_CUSTOM_API_KEY_LIFETIME_DAYS = 1;

export const MAX_API_KEY_LIFETIME_DAYS = 365;

export const API_KEY_LIFETIMES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: MAX_API_KEY_LIFETIME_DAYS, label: "1 year" }
] as const;

export type ApiKeyLifetimeDays = (typeof API_KEY_LIFETIMES)[number]["days"];

export const DEFAULT_API_KEY_LIFETIME_DAYS: ApiKeyLifetimeDays = 365;

export const EXPIRING_SOON_WITHIN_DAYS = 7;

export const API_KEY_DATE_FORMAT = "MMM d, yyyy";

export type ApiKeyExpiryStatus = "never" | "active" | "expiringSoon" | "expired";

export function getApiKeyExpiryDate(lifetimeDays: number, now: Date) {
  return addDays(now, lifetimeDays);
}

export function getCustomApiKeyExpiryDate(expiryDay: Date, now: Date) {
  const lifetimeDays = Math.max(differenceInCalendarDays(expiryDay, now), MIN_CUSTOM_API_KEY_LIFETIME_DAYS);
  return getApiKeyExpiryDate(lifetimeDays, now);
}

export function getCustomApiKeyExpiryDayRange(now: Date) {
  return { earliest: addDays(now, MIN_CUSTOM_API_KEY_LIFETIME_DAYS), latest: addDays(now, MAX_API_KEY_LIFETIME_DAYS) };
}

export function getApiKeyExpiryStatus(expiresAt: string | null, now: Date): ApiKeyExpiryStatus {
  if (!expiresAt) return "never";

  const expiryDate = new Date(expiresAt);
  if (!isAfter(expiryDate, now)) return "expired";

  return differenceInCalendarDays(expiryDate, now) <= EXPIRING_SOON_WITHIN_DAYS ? "expiringSoon" : "active";
}
