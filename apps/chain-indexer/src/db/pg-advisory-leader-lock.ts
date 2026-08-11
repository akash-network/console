import { setTimeout as delay } from "node:timers/promises";
import type postgres from "postgres";

import type { LoggerService } from "@src/providers/logging.provider";

const ACQUIRE_RETRY_MS = 5_000;

/** The advisory-lock session was replaced (e.g. a transparent driver reconnect), so another process may hold leadership. */
export class LeadershipLostError extends Error {}

/**
 * Single-leader election on a session-scoped pg advisory lock. The lock dies silently with its
 * session, so holders must re-verify leadership with assertHeld() before trusting it.
 */
export class PgAdvisoryLeaderLock {
  readonly #client: postgres.Sql;
  readonly #lockKey: number;
  readonly #logger: LoggerService;
  readonly #eventPrefix: string;

  #reserved: postgres.ReservedSql | undefined;
  #leaderBackendPid: number | undefined;

  constructor(options: { client: postgres.Sql; lockKey: number; logger: LoggerService; eventPrefix: string }) {
    this.#client = options.client;
    this.#lockKey = options.lockKey;
    this.#logger = options.logger;
    this.#eventPrefix = options.eventPrefix;
  }

  /** Spins until the lock is acquired or shouldAbort() returns true. */
  async acquire(shouldAbort: () => boolean): Promise<void> {
    this.#reserved = await this.#client.reserve();

    while (!shouldAbort()) {
      const [{ acquired }] = await this.#reserved`SELECT pg_try_advisory_lock(${this.#lockKey}) AS acquired`;

      if (acquired) {
        const [{ pid }] = await this.#reserved`SELECT pg_backend_pid() AS pid`;
        this.#leaderBackendPid = pid;
        this.#logger.info({ event: `${this.#eventPrefix}_LEADERSHIP_ACQUIRED`, backendPid: pid });
        return;
      }

      this.#logger.info({ event: `${this.#eventPrefix}_LEADERSHIP_WAITING` });
      await delay(ACQUIRE_RETRY_MS);
    }
  }

  /** Advisory locks are session-scoped: a transparent driver reconnect creates a fresh session WITHOUT the lock, so the backend pid is re-checked to detect silent leadership loss. */
  async assertHeld(): Promise<void> {
    if (!this.#reserved) {
      throw new LeadershipLostError("Reserved advisory-lock connection is gone");
    }

    const [{ pid }] = await this.#reserved`SELECT pg_backend_pid() AS pid`;

    if (pid !== this.#leaderBackendPid) {
      this.#logger.error({ event: `${this.#eventPrefix}_LEADERSHIP_LOST`, expectedBackendPid: this.#leaderBackendPid, actualBackendPid: pid });
      throw new LeadershipLostError(`Advisory-lock session changed (backend pid ${this.#leaderBackendPid} -> ${pid})`);
    }
  }

  /** release() may throw when the pg pool was ended first; the connection is already gone then, which is the goal. */
  release(): void {
    try {
      this.#reserved?.release();
    } catch (error) {
      this.#logger.debug({ event: `${this.#eventPrefix}_LOCK_RELEASE_SKIPPED`, error });
    }
  }
}
