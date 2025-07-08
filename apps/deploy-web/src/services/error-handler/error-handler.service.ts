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
    return {
      traceId: data["sentry-trace"],
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
  baggage?: string;
}
