import type { LoggerService } from "@akashnetwork/logging";
import { LRUCache } from "lru-cache";

/** ECONNRESET is listed only because ProviderProxy never reports a destroy it caused itself (its own per-attempt timeouts, client aborts and shared-agent teardowns all surface as ECONNRESET too). */
const UNREACHABLE_ERRNOS = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET"];

function isUnreachableErrno(errno: string | undefined): errno is string {
  return !!errno && UNREACHABLE_ERRNOS.includes(errno);
}

/** Floor for how long a tracked provider is kept in memory. Eviction is a memory backstop, never a decision. */
const MIN_STATE_RETENTION_MS = 10 * 60 * 1000;

/** An entry must outlive the cooldown it encodes, since evicting mid-cooldown resumes dialing a host known to be down. */
export function toStateRetentionMs(cooldownMs: number): number {
  return Math.max(MIN_STATE_RETENTION_MS, cooldownMs * 2);
}

export interface ProviderConnectionTrackerOptions {
  failureThreshold: number;
  cooldownMs: number;
  maxCooldownMs: number;
}

export interface ProviderConnectionTrackerInstrumentation {
  onCooldownStarted?(key: string, errno: string, until: number): void;
  onProbeAllowed?(key: string, consecutiveFailures: number): void;
  onCleared?(key: string): void;
}

interface ProviderConnectionState {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastError: unknown;
}

export class ProviderConnectionTracker {
  private readonly states: LRUCache<string, ProviderConnectionState>;

  constructor(
    private readonly now: () => number,
    private readonly options: ProviderConnectionTrackerOptions,
    private readonly instrumentation?: ProviderConnectionTrackerInstrumentation
  ) {
    this.states = new LRUCache<string, ProviderConnectionState>({
      max: 10_000,
      ttl: toStateRetentionMs(options.maxCooldownMs)
    });
  }

  /**
   * Consumes the single probe allowed per cooldown window, so calling this is a decision rather than a
   * question. Letting the probe through also re-arms the window, which means a stampede of concurrent
   * requests produces exactly one dial and a still-dead provider stays skipped without any timer.
   */
  shouldSkipDial(key: string): boolean {
    const state = this.states.get(key);
    if (!state || state.cooldownUntil === 0) return false;

    if (this.now() < state.cooldownUntil) return true;

    state.cooldownUntil = this.now() + this.cooldownMsAfter(state.consecutiveFailures);
    this.states.set(key, state);
    this.instrumentation?.onProbeAllowed?.(key, state.consecutiveFailures);
    return false;
  }

  /** Another dial now would only repeat the failure just recorded, so callers stop retrying instead. */
  isRepeatedFailure(key: string, errno: string | undefined): boolean {
    return isUnreachableErrno(errno) && (this.states.get(key)?.consecutiveFailures ?? 0) > 1;
  }

  recordUnreachable(key: string, error: unknown, errno: string | undefined): void {
    if (!isUnreachableErrno(errno)) return;

    const state = this.states.get(key) ?? { consecutiveFailures: 0, cooldownUntil: 0, lastError: error };
    state.consecutiveFailures += 1;
    state.lastError = error;

    if (state.consecutiveFailures >= this.options.failureThreshold) {
      state.cooldownUntil = this.now() + this.cooldownMsAfter(state.consecutiveFailures);
      this.instrumentation?.onCooldownStarted?.(key, errno, state.cooldownUntil);
    }

    this.states.set(key, state);
  }

  /** Doubling each window keeps a provider that has been dark for days from costing a dial every minute. */
  private cooldownMsAfter(consecutiveFailures: number): number {
    const doublings = Math.max(0, consecutiveFailures - this.options.failureThreshold);
    return Math.min(this.options.cooldownMs * 2 ** doublings, this.options.maxCooldownMs);
  }

  recordReachable(key: string): void {
    if (!this.states.has(key)) return;

    this.states.delete(key);
    this.instrumentation?.onCleared?.(key);
  }

  getLastError(key: string): unknown {
    return this.states.get(key)?.lastError;
  }
}

export function createProviderConnectionTrackerInstrumentation(logger: LoggerService): ProviderConnectionTrackerInstrumentation {
  return {
    onCooldownStarted: (key, errno, until) => logger.warn({ event: "PROVIDER_UNREACHABLE_COOLDOWN_STARTED", key, errno, until }),
    onProbeAllowed: (key, consecutiveFailures) => logger.info({ event: "PROVIDER_UNREACHABLE_PROBE_ALLOWED", key, consecutiveFailures }),
    onCleared: key => logger.info({ event: "PROVIDER_UNREACHABLE_CLEARED", key })
  };
}
