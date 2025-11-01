import { context, trace } from "@opentelemetry/api";

import type { LoggerOptions } from "../../services/logger/logger.service";
import { LoggerService } from "../../services/logger/logger.service";

/**
 * Collects OpenTelemetry span context for logging
 * This mixin adds trace information to log entries
 * @deprecated Use `createOtelLogger` instead of setting `LoggerService.mixin` directly
 */
export function collectOtel() {
  const currentSpan = trace.getSpan(context.active());
  return { ...currentSpan?.spanContext() };
}

/**
 * Creates a logger service with OpenTelemetry integration
 * @param options - Optional logger configuration options
 * @returns LoggerService instance configured with OTEL mixin
 */
export function createOtelLogger(options?: LoggerOptions): LoggerService {
  return new LoggerService({ ...options, mixin: collectOtel });
}
