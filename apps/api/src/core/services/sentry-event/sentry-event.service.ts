import * as Sentry from "@sentry/node";
import type { Event } from "@sentry/types";
import type { StackFrame } from "@sentry/types/types/stackframe";
import { singleton } from "tsyringe";

type ErrorType = Error & {
  status?: number;
  statusCode?: number;
  toJSON?: () => Record<string, any>;
};
type ObjectErrorType = Record<string, any>;
export type ErrorCatchType = ErrorType | ObjectErrorType | string | unknown;

@singleton()
export class SentryEventService {
  public toEvent(error: ErrorCatchType): Event {
    const reportableError = error && typeof error === "object" && "toJSON" in error && typeof error.toJSON === "function" ? error.toJSON() : error;

    if (reportableError instanceof Error) {
      return this.toEventFromError(reportableError);
    }

    if (typeof reportableError === "string") {
      return this.toEventFromMessage(reportableError);
    }

    if (typeof reportableError === "object" && reportableError !== null) {
      return this.toEventFromObject(reportableError);
    }

    return reportableError;
  }

  public toEventFromError(error: ErrorType): Event {
    return {
      message: error.message,
      exception: {
        values: [
          {
            type: error.constructor.name,
            value: error.message,
            stacktrace: this.getStackFrames(error)
          }
        ]
      }
    };
  }

  public toEventFromMessage(message: string): Event {
    return {
      message,
      exception: {
        values: [
          {
            type: message.constructor.name,
            value: message
          }
        ]
      }
    };
  }

  public toEventFromObject(payload: ObjectErrorType): Event {
    let message = typeof payload === "object" && (("message" in payload && payload.message) || ("title" in payload && payload.title));

    if (!message) {
      message = JSON.stringify(payload);

      if (message.length > 100) {
        message = message.slice(0, 100) + "...";
      }
    }

    return {
      message: message,
      extra: payload,
      exception: {
        values: [
          {
            type: payload.name || payload.constructor.name,
            value: message,
            stacktrace: this.getStackFrames(payload)
          }
        ]
      }
    };
  }

  private getStackFrames(payload?: { stack?: string }): { frames: StackFrame[] } | undefined {
    return payload?.stack ? { frames: Sentry.defaultStackParser(payload.stack) } : undefined;
  }
}
