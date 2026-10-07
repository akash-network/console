/** Every network's managed-wallet cache, which held a provider token able to open a shell on the user's leases. */
const RETIRED_KEY_PATTERN = /\/managed-wallets$/;

/** Configure drafts this browser kept before they moved to the account. */
const LEGACY_DRAFT_KEY_PATTERN = /^configure-draft:/;

/** Matches how long the account keeps a draft, since a browser draft is only picked up again through its link. */
const LEGACY_DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Runs on every start rather than once, so a browser coming back from any older release forgets what that release left behind. */
export function forgetRetiredStorage(storage: Storage, now = Date.now()): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  keys.filter((key): key is string => key !== null && isRetired(storage, key, now)).forEach(key => storage.removeItem(key));
}

function isRetired(storage: Storage, key: string, now: number): boolean {
  return RETIRED_KEY_PATTERN.test(key) || (LEGACY_DRAFT_KEY_PATTERN.test(key) && isLegacyDraftPastRetention(storage.getItem(key), now));
}

/** A draft that cannot say when it was last saved is treated as past it. */
function isLegacyDraftPastRetention(raw: string | null, now: number): boolean {
  try {
    const { updatedAt } = JSON.parse(raw ?? "") as { updatedAt?: unknown };
    return typeof updatedAt !== "number" || now - updatedAt >= LEGACY_DRAFT_RETENTION_MS;
  } catch {
    return true;
  }
}
