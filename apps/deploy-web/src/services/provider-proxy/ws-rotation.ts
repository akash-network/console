import type { LoggerService } from "@akashnetwork/logging";

export class RotationTracker {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_PER_WINDOW = 3;
  private readonly timestamps: number[] = [];

  constructor(
    private readonly logger: LoggerService,
    private readonly url: string
  ) {}

  allowRotation(): boolean {
    const now = Date.now();
    while (this.timestamps.length > 0 && this.timestamps[0] < now - RotationTracker.WINDOW_MS) {
      this.timestamps.shift();
    }
    this.timestamps.push(now);
    if (this.timestamps.length > RotationTracker.MAX_PER_WINDOW) {
      this.logger.error({ event: "WS_ROTATION_LIMIT_EXCEEDED", url: this.url });
      return false;
    }
    return true;
  }
}

export function isTokenExpiredMessage(message: unknown): boolean {
  return typeof message === "object" && message !== null && (message as { error?: string }).error === "tokenExpired";
}

export function mergeSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const defined = signals.filter((s): s is AbortSignal => !!s);
  if (defined.length === 0) return new AbortController().signal;
  if (defined.length === 1) return defined[0];
  return AbortSignal.any(defined);
}
