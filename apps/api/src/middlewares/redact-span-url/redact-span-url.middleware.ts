import { redactUrlCredentials } from "@akashnetwork/logging/url";
import { trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";

/** @hono/otel records the request's full URL on its span with no hook to redact it, so the attribute is rewritten from inside that span. */
export const redactSpanUrlCredentials: MiddlewareHandler = async (c, next) => {
  trace.getActiveSpan()?.setAttribute("url.full", redactUrlCredentials(c.req.url));
  await next();
};
