import { LoggerService } from "@akashnetwork/logging";
import { context, trace } from "@opentelemetry/api";
import type { Event } from "@sentry/types";
import type { Context, Env } from "hono";
import { isHttpError } from "http-errors";
import omit from "lodash/omit";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = new LoggerService({ context: "ErrorHandler" });

  constructor(
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {
    this.handle = this.handle.bind(this);
  }

  async handle<E extends Env = any>(error: Error, c: Context<E>): Promise<Response> {
    this.logger.error(error);

    if (isHttpError(error)) {
      const { name } = error.constructor;
      return c.json({ error: name, message: error.message, data: error.data }, { status: error.status });
    }

    if (error instanceof ZodError) {
      return c.json({ error: "BadRequestError", data: error.errors }, { status: 400 });
    }

    await this.reportError(error, c);

    return c.json({ error: "InternalServerError" }, { status: 500 });
  }

  private async reportError<E extends Env = any>(error: Error, c: Context<E>): Promise<void> {
    try {
      const id = this.sentry.captureEvent(await this.getSentryEvent(error, c));
      this.logger.info({ event: "SENTRY_EVENT_REPORTED", id });
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async getSentryEvent<E extends Env = any>(error: Error, c: Context<E>): Promise<Event> {
    const event = this.sentry.addRequestDataToEvent(this.sentryEventService.toEvent(error), {
      method: c.req.method,
      url: c.req.url,
      headers: omit(Object.fromEntries(c.req.raw.headers), ["x-anonymous-user-id"]),
      body: await this.getSentryEventRequestBody(c)
    });
    const currentSpan = trace.getSpan(context.active());

    if (currentSpan) {
      const context = currentSpan.spanContext();
      event.contexts = {
        ...event.contexts,
        trace: {
          trace_id: context.traceId,
          span_id: context.spanId
        }
      };
    }

    return event;
  }

  private async getSentryEventRequestBody<E extends Env = any>(c: Context<E>) {
    switch (c.req.header("content-type")) {
      case "text/plain":
        return await c.req.text();
      case "application/json":
        return await c.req.json();
      case "application/x-www-form-urlencoded":
      case "multipart/form-data":
        return await c.req.parseBody();
      default:
        return undefined;
    }
  }
}
