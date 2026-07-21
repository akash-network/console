import type { SpanContext } from "@opentelemetry/api";
import { context, propagation, trace } from "@opentelemetry/api";

import { LoggerService } from "../../services/logger/logger.service";
import type { CreateLogger } from "../../types";

/**
 * Collects OpenTelemetry span context for logging
 * This mixin adds trace information to log entries
 * @deprecated Use `createOtelLogger` instead of setting `LoggerService.mixin` directly
 */
export function collectOtel(): Partial<SpanContext> & { jobId?: string; userId?: string } {
  const currentSpan = trace.getSpan(context.active());
  const spanContext = currentSpan?.spanContext();
  const currentBaggage = propagation.getBaggage(context.active());
  const jobId = currentBaggage?.getEntry("job.id")?.value;
  const userId = currentBaggage?.getEntry("user.id")?.value;

  return {
    ...spanContext,
    ...(jobId && { jobId }),
    ...(userId && { userId })
  };
}

/**
 * Creates a logger service with OpenTelemetry integration
 * @param options - Optional logger configuration options
 * @returns LoggerService instance configured with OTEL mixin
 */
export const createOtelLogger: CreateLogger = options => {
  return new LoggerService({ ...options, mixin: collectOtel });
};
