import { getDomain } from "tldts";

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";

export const MAX_EMAIL_DOMAIN_LENGTH = 253;

/** Shared with the `blocked_email_domains` CHECK constraint, whose POSIX matcher reads this same source, so both sides agree on what normalized means. */
export const NORMALIZED_DOMAIN_PATTERN = new RegExp(`^${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+$`);

const PLUS_TAG_PATTERN = /\+[^@]*(@[^@]*)$/;

/**
 * Returns the normalized domain of an email address, or null when there isn't one to act on. Every caller
 * treats null as "not blocked", so an address we cannot parse can never be refused by mistake.
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  return splitEmailAddress(email)?.domain ?? null;
}

/** Auth0 links accounts whose addresses agree once lowercased and stripped of a plus tag, so such addresses normalize alike. */
export function normalizeEmailAddress(email: string | null | undefined): string | null {
  const address = splitEmailAddress(email?.replace(PLUS_TAG_PATTERN, "$1"));

  return address ? `${address.localPart}@${address.domain}` : null;
}

function splitEmailAddress(email: string | null | undefined): { localPart: string; domain: string } | null {
  if (!email) return null;

  const trimmed = email.trim();
  const separatorIndex = trimmed.lastIndexOf("@");

  if (separatorIndex <= 0) return null;

  const domain = normalizeEmailDomain(trimmed.slice(separatorIndex + 1));

  return domain ? { localPart: trimmed.slice(0, separatorIndex).toLowerCase(), domain } : null;
}

/** Matching is exact, so a domain only ever matches a stored row when both went through this. */
export function normalizeEmailDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;

  const withoutRootLabel = domain.trim().toLowerCase().replace(/\.$/, "");

  if (withoutRootLabel.length > MAX_EMAIL_DOMAIN_LENGTH) return null;
  if (!NORMALIZED_DOMAIN_PATTERN.test(withoutRootLabel)) return null;

  return withoutRootLabel;
}

/** Most specific first and never shorter than two labels, so the nearest rule on a domain is the first one that matches. */
export function listDomainAndParents(domain: string): string[] {
  const labels = domain.split(".");

  return Array.from({ length: labels.length - 1 }, (_, index) => labels.slice(index).join("."));
}

export function isWithinDomain(domain: string, parent: string): boolean {
  return domain === parent || domain.endsWith(`.${parent}`);
}

/** Private suffixes such as github.io count as public ones, so the result is never a suffix shared by unrelated owners; null when the domain is a suffix itself. */
export function getRegistrableDomain(normalizedDomain: string): string | null {
  return getDomain(normalizedDomain, { allowPrivateDomains: true, extractHostname: false });
}
