import { createHmac } from "node:crypto";

import type { UserOutput } from "@src/user/repositories";
import { normalizeEmailAddress } from "@src/workload-abuse/lib/email-domain/email-domain";

export interface AccountHashes {
  identityHash: string | null;
  emailHash: string | null;
}

const IDENTITY_HASH_PURPOSE = "deleted-account-identity";
const EMAIL_HASH_PURPOSE = "deleted-account-email";

/** A stored hash only matches while the secret and both purposes stay as they were when it was written. */
export function hashAccount(secret: string, account: Pick<UserOutput, "userId" | "email">): AccountHashes {
  const email = normalizeEmailAddress(account.email);

  return {
    identityHash: account.userId ? keyedHash(secret, IDENTITY_HASH_PURPOSE, account.userId) : null,
    emailHash: email ? keyedHash(secret, EMAIL_HASH_PURPOSE, email) : null
  };
}

function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}
