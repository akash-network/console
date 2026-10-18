import { addDays, addHours } from "date-fns";

export const MAX_API_KEY_LIFETIME_DAYS = 365;

/** Keeps a one-year expiry computed by a client whose clock runs ahead of the API's from being rejected. */
const CLIENT_CLOCK_SKEW_ALLOWANCE_HOURS = 24;

export function getDefaultApiKeyExpiry(now: Date) {
  return addDays(now, MAX_API_KEY_LIFETIME_DAYS);
}

export function isWithinMaxApiKeyLifetime(expiresAt: Date, now: Date) {
  return expiresAt <= addHours(getDefaultApiKeyExpiry(now), CLIENT_CLOCK_SKEW_ALLOWANCE_HOURS);
}
