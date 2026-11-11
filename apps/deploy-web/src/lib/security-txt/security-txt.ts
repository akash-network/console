export const SECURITY_TXT_PATH = "/.well-known/security.txt";
export const SECURITY_CONTACT_URL = "https://github.com/akash-network/console/security/advisories/new";
export const SECURITY_POLICY_URL = "https://github.com/akash-network/console/security/policy";

/** RFC 9116 asks for an expiry less than a year ahead, and the file is rebuilt on every request so it never goes stale. */
export const MAX_SECURITY_TXT_VALIDITY_DAYS = 180;

const CANONICAL_URL = `https://console.akash.network${SECURITY_TXT_PATH}`;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildSecurityTxt(now: Date): string {
  const expiresAt = new Date(now.getTime() + MAX_SECURITY_TXT_VALIDITY_DAYS * MILLISECONDS_PER_DAY);

  return [
    `Contact: ${SECURITY_CONTACT_URL}`,
    `Expires: ${expiresAt.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${CANONICAL_URL}`,
    `Policy: ${SECURITY_POLICY_URL}`,
    ""
  ].join("\n");
}
