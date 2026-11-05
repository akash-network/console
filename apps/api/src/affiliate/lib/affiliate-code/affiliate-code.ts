import { randomInt } from "crypto";

const AFFILIATE_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const GENERATED_CODE_LENGTH = 8;
const GENERATED_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeAffiliateCode(raw: string): string | undefined {
  const normalized = raw.trim().toLowerCase();
  return AFFILIATE_CODE_PATTERN.test(normalized) ? normalized : undefined;
}

export function generateAffiliateCode(): string {
  return Array.from({ length: GENERATED_CODE_LENGTH }, () => GENERATED_CODE_ALPHABET[randomInt(GENERATED_CODE_ALPHABET.length)]).join("");
}
