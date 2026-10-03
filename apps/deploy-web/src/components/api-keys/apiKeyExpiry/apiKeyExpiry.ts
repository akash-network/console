import { addDays, differenceInCalendarDays, isAfter } from "date-fns";

export const API_KEY_LIFETIMES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" }
] as const;

export type ApiKeyLifetimeDays = (typeof API_KEY_LIFETIMES)[number]["days"];

export const DEFAULT_API_KEY_LIFETIME_DAYS: ApiKeyLifetimeDays = 365;

export const EXPIRING_SOON_WITHIN_DAYS = 7;

export type ApiKeyExpiryStatus = "never" | "active" | "expiringSoon" | "expired";

export function getApiKeyExpiryDate(lifetimeDays: ApiKeyLifetimeDays, now: Date) {
  return addDays(now, lifetimeDays);
}

export function getApiKeyExpiryStatus(expiresAt: string | null, now: Date): ApiKeyExpiryStatus {
  if (!expiresAt) return "never";

  const expiryDate = new Date(expiresAt);
  if (!isAfter(expiryDate, now)) return "expired";

  return differenceInCalendarDays(expiryDate, now) <= EXPIRING_SOON_WITHIN_DAYS ? "expiringSoon" : "active";
}
