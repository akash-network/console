import type { Context, Next } from "hono";
import createError from "http-errors";
import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { CORE_CONFIG, type CoreConfig } from "@src/core/providers/config.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { HonoInterceptor } from "@src/core/types/hono-interceptor.type";

type RefusalStreak = { status: number; refusals: number; startedAt: number; backoffUntil?: number };

const MAX_TRACKED_STREAKS = 1e5;
/** A few numbers under a user, method and path key, so the registry ranks this cache far below the ones holding response payloads. */
const STREAK_ENTRY_BYTES = 256;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UNCOUNTED_CLIENT_ERRORS = new Set([401, 429]);
const IN_FLIGHT_RETRY_AFTER_SECONDS = 1;

/** The path is caller controlled, so it is hashed to keep every key the size the entry estimate assumes. */
function digestOf(path: string): string {
  return createHash("sha256").update(path).digest("base64url");
}

@singleton()
export class RefusalBackoffInterceptor implements HonoInterceptor {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #streaks: LRUCache<string, RefusalStreak>;
  readonly #requestsInFlight = new Map<string, number>();

  constructor(
    @inject(CORE_CONFIG) private readonly config: CoreConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: RefusalBackoffInterceptor.name });
    this.#streaks = new LRUCache<string, RefusalStreak>({
      max: MAX_TRACKED_STREAKS,
      ...nominalEntrySizing(MAX_TRACKED_STREAKS, STREAK_ENTRY_BYTES)
    });
    cacheRegistry.register("RefusalBackoffInterceptor#streaks", this.#streaks);
  }

  intercept() {
    return async (c: Context, next: Next) => {
      const userId: string | undefined = c.get("user")?.id;

      if (!this.config.REPEATED_REFUSAL_LIMIT || !userId || SAFE_METHODS.has(c.req.method)) {
        return await next();
      }

      const key = `${userId} ${c.req.method} ${digestOf(c.req.path)}`;
      const retryAfterSeconds = this.#secondsLeftInBackoff(key) || (this.#wouldPassLimitWithRequestsInFlight(key) ? IN_FLIGHT_RETRY_AFTER_SECONDS : 0);

      if (retryAfterSeconds) {
        throw createError(429, "This request has been refused repeatedly. Wait before sending it again.", {
          errorCode: "repeated_refusal",
          headers: { "Retry-After": String(retryAfterSeconds) }
        });
      }

      this.#requestsInFlight.set(key, (this.#requestsInFlight.get(key) ?? 0) + 1);
      try {
        await next();
      } finally {
        this.#release(key);
      }
      this.#record(key, userId, c);
    };
  }

  #secondsLeftInBackoff(key: string): number {
    const backoffUntil = this.#streaks.get(key)?.backoffUntil ?? 0;
    return Math.max(0, Math.ceil((backoffUntil - Date.now()) / 1000));
  }

  /** Counts identical requests still in flight as refusals once a streak exists, so a parallel burst cannot run past the limit before its answers come back. */
  #wouldPassLimitWithRequestsInFlight(key: string): boolean {
    const streak = this.#streaks.get(key);
    if (!streak || !this.#isWithinWindow(streak, Date.now())) return false;

    return streak.refusals + (this.#requestsInFlight.get(key) ?? 0) >= this.config.REPEATED_REFUSAL_LIMIT;
  }

  #isWithinWindow(streak: RefusalStreak, now: number): boolean {
    return now - streak.startedAt < this.config.REPEATED_REFUSAL_WINDOW_SECONDS * 1000;
  }

  #release(key: string): void {
    const inFlight = this.#requestsInFlight.get(key)!;

    if (inFlight > 1) {
      this.#requestsInFlight.set(key, inFlight - 1);
    } else {
      this.#requestsInFlight.delete(key);
    }
  }

  #record(key: string, userId: string, c: Context): void {
    const { status } = c.res;

    if (status < 400) {
      this.#streaks.delete(key);
      return;
    }

    if (status >= 500 || UNCOUNTED_CLIENT_ERRORS.has(status) || this.#secondsLeftInBackoff(key)) return;

    const now = Date.now();
    const streak = this.#streaks.get(key);
    const continues = streak?.status === status && this.#isWithinWindow(streak, now);
    const refusals = continues ? streak.refusals + 1 : 1;

    if (refusals < this.config.REPEATED_REFUSAL_LIMIT) {
      this.#streaks.set(key, { status, refusals, startedAt: continues ? streak.startedAt : now });
      return;
    }

    this.#streaks.set(key, { status, refusals: 0, startedAt: now, backoffUntil: now + this.config.REPEATED_REFUSAL_BACKOFF_SECONDS * 1000 });
    this.#logger.warn({ event: "REPEATED_REFUSAL_BACKOFF_STARTED", userId, method: c.req.method, path: c.req.path, status, refusals });
  }
}
