import { forceUnlockFaucet } from "./services/fs-lock";

/**
 * Jest global setup for functional tests.
 *
 * This setup cleans up any stale faucet locks from previous crashed runs
 * to ensure tests can acquire the lock properly.
 */
export default async () => {
  // Clean up any stale faucet lock from previous crashed test runs
  await forceUnlockFaucet();
  console.log("[global-setup] Cleaned up any stale faucet locks.");
};
