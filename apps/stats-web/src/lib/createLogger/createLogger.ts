import type { LoggerOptions } from "@akashnetwork/logging";
import { LoggerService } from "@akashnetwork/logging";
import { getTraceData } from "@sentry/nextjs";

export function createLogger(options?: LoggerOptions) {
  return new LoggerService({
    ...options,
    mixin: () => {
      const traceData = getTraceData();
      return {
        traceId: traceData["sentry-trace"],
        baggage: traceData.baggage
      };
    }
  });
}
