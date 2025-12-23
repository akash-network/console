import { isHttpError } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import type { SeverityLevel as SentrySeverityLevel } from "@sentry/nextjs";
import { captureException as captureExceptionInSentry, getTraceData } from "@sentry/nextjs";

export class ErrorHandlerService {
  constructor(
    private readonly logger: LoggerService,
    private readonly captureException = captureExceptionInSentry
  ) {}

  getTraceData(): TraceData {
    const data = getTraceData();
    const traceId = data["sentry-trace"];

    return {
      traceId,
      traceIdW3C: sentryTraceToW3C(traceId),
      baggage: data.baggage
    };
  }

  reportError({ severity, error, tags, ...extra }: ErrorContext): void {
    const finalTags: Record<string, string> = { ...tags };

    if (isHttpError(error) && error.response && error.response.status !== 400) {
      finalTags.status = error.response.status.toString();
      finalTags.method = error.response.config.method?.toUpperCase() || "UNKNOWN";
      finalTags.url = error.response.config.url || "UNKNOWN";
      extra.headers = error.response.headers;
    }

    this.logger.error({ ...extra, ...finalTags, error });
    this.captureException(error, {
      level: severity,
      extra,
      tags: finalTags
    });
  }

  wrapCallback<T extends (...args: any[]) => any>(fn: T, options?: WrapCallbackOptions<ReturnType<T>>): T {
    return ((...args) => {
      try {
        const result = fn(...args);
        if (result && typeof result.catch === "function") {
          return result.catch((error: unknown) => {
            this.reportError({ error, tags: options?.tags });
            if (options?.fallbackValue) return options.fallbackValue();
          });
        }
        return result;
      } catch (error) {
        this.reportError({ error, tags: options?.tags });
        if (options?.fallbackValue) return options.fallbackValue();
      }
    }) as T;
  }
}

export type SeverityLevel = SentrySeverityLevel;

export interface ErrorContext {
  [key: string]: unknown;
  severity?: SeverityLevel;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface WrapCallbackOptions<TValue> {
  tags?: Record<string, string>;
  fallbackValue?: () => TValue;
}

export interface TraceData {
  traceId?: string;
  traceIdW3C?: string;
  baggage?: string;
}

/**
 * Converts Sentry `sentry-trace` header value into a valid W3C `traceparent`.
 *
 * Sentry: `<traceId>-<spanId>-<sampled>` where sampled is `0|1` (optional).
 * W3C:    `00-<traceId>-<parentSpanId>-<flags>` where flags is 2 hex chars (`00|01`).
 */
export function sentryTraceToW3C(sentryTrace?: string): string | undefined {
  const value = sentryTrace?.trim();
  if (!value) return;

  const [traceId, spanId, sampled] = value.split("-", 3);
  // W3C spec disallows all-zero ids
  if (!traceId || !spanId || Number(traceId) === 0 || Number(spanId) === 0) return;

  const flags = Number(sampled) === 1 ? "01" : "00";
  return `00-${traceId}-${spanId}-${flags}`;
}
