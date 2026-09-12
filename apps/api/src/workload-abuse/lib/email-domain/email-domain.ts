import { MAX_EMAIL_DOMAIN_LENGTH } from "@src/workload-abuse/model-schemas/blocked-email-domain/blocked-email-domain.schema";

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_PATTERN = new RegExp(`^${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+$`);

/**
 * Returns the normalized domain of an email address, or null when there isn't one to act on. Every caller
 * treats null as "not blocked", so an address we cannot parse can never be refused by mistake.
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;

  const trimmed = email.trim();
  const separatorIndex = trimmed.lastIndexOf("@");

  if (separatorIndex <= 0) return null;

  return normalizeEmailDomain(trimmed.slice(separatorIndex + 1));
}

/** Matching is exact, so a domain only ever matches a stored row when both went through this. */
export function normalizeEmailDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;

  const withoutRootLabel = domain.trim().toLowerCase().replace(/\.$/, "");

  if (withoutRootLabel.length > MAX_EMAIL_DOMAIN_LENGTH) return null;
  if (!DOMAIN_PATTERN.test(withoutRootLabel)) return null;

  return withoutRootLabel;
}
