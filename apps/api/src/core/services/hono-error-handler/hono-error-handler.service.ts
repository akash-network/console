import { LoggerService } from "@akashnetwork/logging";
import { ForbiddenError } from "@casl/ability";
import { context, trace } from "@opentelemetry/api";
import type { Event } from "@sentry/types";
import type { Context, Env } from "hono";
import { isHttpError } from "http-errors";
import omit from "lodash/omit";
import { singleton } from "tsyringe";
import { ZodError } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";

@singleton()
export class HonoErrorHandlerService {
  private readonly logger = LoggerService.forContext("ErrorHandler");

  constructor(
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService,
    private readonly authService: AuthService
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

    if (error instanceof ForbiddenError) {
      return c.json({ error: "ForbiddenError", message: "Forbidden" }, { status: 403 });
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

  private async getSentryEvent<
    E extends {
      Variables: ClientInfoContextVariables;
    } = any
  >(error: Error, c: Context<E>): Promise<Event> {
    const event = this.sentry.addRequestDataToEvent(this.sentryEventService.toEvent(error), {
      method: c.req.method,
      url: c.req.url,
      headers: omit(Object.fromEntries(c.req.raw.headers), ["x-anonymous-user-id"]),
      body: await this.getSentryEventRequestBody(c)
    });

    const { currentUser } = this.authService;

    if (currentUser) {
      event.user = {
        id: currentUser.id
      };
    }

    const clientInfo = c.get("clientInfo");

    if (clientInfo) {
      event.fingerprint = [clientInfo.fingerprint];
      event.user = event.user || {};
      event.user.ip_address = clientInfo.ip;
    }

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
