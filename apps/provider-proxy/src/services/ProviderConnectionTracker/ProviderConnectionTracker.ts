import type { LoggerService } from "@akashnetwork/logging";
import { LRUCache } from "lru-cache";

/**
 * Errnos that mean the host itself is not there: no route, no DNS, nothing listening. They stay true for as
 * long as the provider is down, so re-dialing on every request only buys another connect timeout.
 *
 * ECONNRESET, ETIMEDOUT and EPIPE are deliberately absent. The proxy destroys its own request when the
 * per-attempt timeout fires and a client abort does the same, both surfacing as ECONNRESET, so treating them
 * as unreachable would let one slow poll blind every other caller on a healthy provider.
 */
const UNREACHABLE_ERRNOS = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"];

export interface ProviderConnectionTrackerOptions {
  failureThreshold: number;
  cooldownMs: number;
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
  private readonly states = new LRUCache<string, ProviderConnectionState>({
    max: 10_000,
    ttl: 10 * 60 * 1000
  });

  constructor(
    private readonly now: () => number,
    private readonly options: ProviderConnectionTrackerOptions,
    private readonly instrumentation?: ProviderConnectionTrackerInstrumentation
  ) {}

  /**
   * Consumes the single probe allowed per cooldown window, so calling this is a decision rather than a
   * question. Letting the probe through also re-arms the window, which means a stampede of concurrent
   * requests produces exactly one dial and a still-dead provider stays skipped without any timer.
   */
  shouldSkipDial(key: string): boolean {
    const state = this.states.get(key);
    if (!state || state.cooldownUntil === 0) return false;

    if (this.now() < state.cooldownUntil) return true;

    state.cooldownUntil = this.now() + this.options.cooldownMs;
    this.instrumentation?.onProbeAllowed?.(key, state.consecutiveFailures);
    return false;
  }

  recordUnreachable(key: string, error: unknown, errno: string | undefined): void {
    if (!errno || !UNREACHABLE_ERRNOS.includes(errno)) return;

    const state = this.states.get(key) ?? { consecutiveFailures: 0, cooldownUntil: 0, lastError: error };
    state.consecutiveFailures += 1;
    state.lastError = error;

    if (state.consecutiveFailures >= this.options.failureThreshold) {
      state.cooldownUntil = this.now() + this.options.cooldownMs;
      this.instrumentation?.onCooldownStarted?.(key, errno, state.cooldownUntil);
    }

    this.states.set(key, state);
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
