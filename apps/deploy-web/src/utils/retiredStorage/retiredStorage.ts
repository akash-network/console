/** Every network's managed-wallet cache, which held a provider token able to open a shell on the user's leases. */
const RETIRED_KEY_PATTERN = /\/managed-wallets$/;

/** Runs on every start rather than once, so a browser coming back from any older release forgets what that release left behind. */
export function forgetRetiredStorage(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  keys.filter((key): key is string => key !== null && RETIRED_KEY_PATTERN.test(key)).forEach(key => storage.removeItem(key));
}
