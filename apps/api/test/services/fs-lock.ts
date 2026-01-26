import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { setTimeout as delay } from "timers/promises";

export interface FsLockOptions {
  /**
   * Maximum time in milliseconds to wait for the lock.
   * @default 5 minutes - faucet operations can be slow
   */
  timeout?: number;
  /**
   * Time in milliseconds after which a lock file is considered stale and can be deleted.
   * This handles cases where a worker may have crashed without releasing the lock.
   * @default 1 minute - short enough to recover from crashes quickly
   */
  staleLockThreshold?: number;
  /**
   * Base delay in milliseconds between lock acquisition retries.
   * Actual delay includes jitter: baseRetryDelay + random(0, baseRetryDelay).
   * @default 100ms
   */
  baseRetryDelay?: number;
}

const DEFAULT_OPTIONS: Required<FsLockOptions> = {
  timeout: 5 * 60 * 1000,
  staleLockThreshold: 60 * 1000,
  baseRetryDelay: 100
};

/**
 * Resolves a lock path. If the input is a simple name (no path separators),
 * it creates the lock file in os.tmpdir(). Otherwise, uses the path as-is.
 */
function resolveLockPath(lockPathOrName: string): string {
  if (!lockPathOrName.includes(path.sep) && !lockPathOrName.includes("/")) {
    return path.join(os.tmpdir(), lockPathOrName);
  }
  return lockPathOrName;
}

/**
 * Checks if a lock file is stale based on its mtime.
 */
async function isLockStale(lockPath: string, staleLockThreshold: number): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(lockPath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs > staleLockThreshold;
  } catch {
    return false;
  }
}

/**
 * Attempts to delete a stale lock file.
 * Returns true if the lock was successfully deleted or didn't exist.
 */
async function tryDeleteStaleLock(lockPath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(lockPath);
    debugLog(`Deleted stale lock file: ${lockPath}`);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return true;
    }
    debugLog(`Failed to delete stale lock: ${lockPath}`, err);
    return false;
  }
}

/**
 * Logs debug messages when DEBUG_FAUCET=1 is set.
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG_FAUCET === "1") {
    console.log(`[fs-lock] ${message}`, ...args);
  }
}

/**
 * Calculates retry delay with jitter.
 */
function getRetryDelay(baseDelay: number): number {
  return baseDelay + Math.random() * baseDelay;
}

/**
 * Executes a function while holding a cross-process filesystem lock.
 *
 * Lock behavior:
 * - Acquires lock via atomic file creation (O_CREAT | O_EXCL).
 * - If lock exists, retries with jitter until acquired or timeout.
 * - If lock file is older than staleLockThreshold, deletes it and retries (handles crashed workers).
 * - Releases lock in finally block: closes handle and unlinks file.
 *
 * @param lockPathOrName - Either a simple name (will be placed in os.tmpdir())
 *                         or a full path to the lock file.
 * @param fn - The async function to execute while holding the lock.
 * @param opts - Optional configuration for timeouts and retry behavior.
 * @returns The return value of fn.
 * @throws Error if lock cannot be acquired within timeout.
 *
 * @example
 * // Global faucet lock
 * await withFsLock("cosmos-faucet.lock", async () => {
 *   await faucet.topup(address, amount);
 * });
 *
 * @example
 * // Custom lock path
 * await withFsLock("/tmp/my-custom.lock", async () => {
 *   // critical section
 * });
 */
export async function withFsLock<T>(lockPathOrName: string, fn: () => Promise<T>, opts?: FsLockOptions): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  if (options.staleLockThreshold < options.timeout) {
    options.staleLockThreshold = options.timeout;
  }

  const lockPath = resolveLockPath(lockPathOrName);
  const startTime = Date.now();

  debugLog(`Attempting to acquire lock: ${lockPath}`);

  let fileHandle: fs.promises.FileHandle | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= options.timeout) {
      throw new Error(`Failed to acquire lock within ${options.timeout}ms: ${lockPath}`);
    }

    try {
      // Attempt atomic lock acquisition using O_CREAT | O_EXCL (wx flag)
      fileHandle = await fs.promises.open(lockPath, "wx");
      debugLog(`Lock acquired: ${lockPath}`);
      break;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;

      if (nodeErr.code === "EEXIST") {
        // Lock file exists - check if it's stale
        if (await isLockStale(lockPath, options.staleLockThreshold)) {
          debugLog(`Lock file is stale, attempting to delete: ${lockPath}`);
          if (await tryDeleteStaleLock(lockPath)) {
            // Retry immediately after deleting stale lock
            continue;
          }
        }

        // Wait with jitter before retrying
        const retryDelay = getRetryDelay(options.baseRetryDelay);
        debugLog(`Lock busy, retrying in ${Math.round(retryDelay)}ms`);
        await delay(retryDelay);
        continue;
      }

      // Unexpected error
      throw err;
    }
  }

  try {
    return await fn();
  } finally {
    // Release lock: close handle and delete file
    try {
      if (fileHandle) {
        await fileHandle.close();
      }
      await fs.promises.unlink(lockPath);
      debugLog(`Lock released: ${lockPath}`);
    } catch (err) {
      debugLog(`Error releasing lock: ${lockPath}`, err);
    }
  }
}

/**
 * Global faucet lock path.
 * Use this constant with withFsLock for faucet operations.
 */
export const FAUCET_LOCK_PATH = `${os.tmpdir()}/cosmos-faucet.lock`;

/**
 * Convenience function for acquiring the global faucet lock.
 *
 * @param fn - The async function to execute while holding the faucet lock.
 * @param opts - Optional configuration for timeouts and retry behavior.
 * @returns The return value of fn.
 *
 * @example
 * await withFaucetLock(async () => {
 *   await faucet.topup(address, amount);
 * });
 */
export async function withFaucetLock<T>(fn: () => Promise<T>, opts?: FsLockOptions): Promise<T> {
  return withFsLock(FAUCET_LOCK_PATH, fn, opts);
}

/**
 * Forcefully removes a lock file if it exists.
 * Use this to clean up stale locks from crashed test runs.
 *
 * @param lockPathOrName - Either a simple name or a full path to the lock file.
 *
 * @example
 * // Clean up the global faucet lock
 * await forceUnlock(FAUCET_LOCK_PATH);
 *
 * // Or using the convenience function
 * await forceUnlockFaucet();
 */
export async function forceUnlock(lockPathOrName: string): Promise<void> {
  const lockPath = resolveLockPath(lockPathOrName);
  try {
    await fs.promises.unlink(lockPath);
    debugLog(`Force unlocked: ${lockPath}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    // Lock file doesn't exist, that's fine
  }
}

/**
 * Forcefully removes the global faucet lock file.
 * Use this to clean up stale locks from crashed test runs.
 *
 * @example
 * // In a cleanup script or before running tests
 * await forceUnlockFaucet();
 */
export async function forceUnlockFaucet(): Promise<void> {
  return forceUnlock(FAUCET_LOCK_PATH);
}
