import type { LoggerService } from "@akashnetwork/logging";
import type { SeverityLevel as SentrySeverityLevel } from "@sentry/react";
import { captureException as captureExceptionInSentry } from "@sentry/react";

export class ErrorHandlerService {
  constructor(
    private readonly logger: LoggerService,
    private readonly captureException = captureExceptionInSentry
  ) {}

  reportError({ severity, error, tags, ...extraContext }: ErrorContext): void {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      return;
    }

    const finalTags: Record<string, string> = { ...tags };

    this.logger.error({ ...extraContext, ...finalTags, error });
    this.captureException(error, {
      level: severity || "error",
      extra: extraContext,
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
