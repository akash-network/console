export const REFERRAL_COOKIE_NAME = "console_referral";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const REFERRAL_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export function normalizeReferralCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : undefined;
}

export function readReferralCode(cookies: Partial<Record<string, string>>): string | undefined {
  return normalizeReferralCode(cookies[REFERRAL_COOKIE_NAME]);
}
