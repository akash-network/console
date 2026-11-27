import { createHmac } from "node:crypto";

import { userAgentMaxLength } from "@src/user/model-schemas/user/user.schema";
import type { UserOutput } from "@src/user/repositories";
import { normalizeEmailAddress } from "@src/workload-abuse/lib/email-domain/email-domain";

export interface AccountHashes {
  identityHash: string | null;
  emailHash: string | null;
}

const IDENTITY_HASH_PURPOSE = "deleted-account-identity";
const EMAIL_HASH_PURPOSE = "deleted-account-email";
const FINGERPRINT_HASH_PURPOSE = "deleted-account-fingerprint";
const BROWSER_HASH_PURPOSE = "refused-signup-browser";

export interface Browser {
  ip: string | null | undefined;
  userAgent: string | null | undefined;
}

/** A stored hash only matches while the secret and its purpose stay as they were when it was written. */
export function hashAccount(secret: string, account: Pick<UserOutput, "userId" | "email">): AccountHashes {
  const email = normalizeEmailAddress(account.email);

  return {
    identityHash: account.userId ? keyedHash(secret, IDENTITY_HASH_PURPOSE, account.userId) : null,
    emailHash: email ? keyedHash(secret, EMAIL_HASH_PURPOSE, email) : null
  };
}

export function hashFingerprint(secret: string, fingerprint: UserOutput["lastFingerprint"]): string | null {
  return fingerprint ? keyedHash(secret, FINGERPRINT_HASH_PURPOSE, fingerprint) : null;
}

/** The user agent is cut to the length an account stores it at, so a refused request and the account created after it hash alike; null without both parts. */
export function hashBrowser(secret: string, { ip, userAgent }: Browser): string | null {
  if (!ip || !userAgent) return null;

  return keyedHash(secret, BROWSER_HASH_PURPOSE, `${ip} ${userAgent.slice(0, userAgentMaxLength)}`);
}

function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
