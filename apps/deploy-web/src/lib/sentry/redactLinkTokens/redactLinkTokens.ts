import type { Breadcrumb, Event } from "@sentry/nextjs";

const TOKEN_PARAMETER = /(^|[#&?;])(token=)[^&#;\s]*/gi;

const REDACTED = "[redacted]";

const URL_DATA_KEYS = ["from", "to", "url", "http.url", "url.full", "http.target", "http.query", "http.fragment", "url.query", "url.fragment"];

type SpanLike = { description?: string; data?: Record<string, unknown> };

export function redactUrlTokens(url: string): string {
  return url.replace(TOKEN_PARAMETER, `$1$2${REDACTED}`);
}

/** Navigation, fetch and xhr breadcrumbs record full URLs, fragment and query included. */
export function redactBreadcrumbTokens(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined && { message: redactUrlTokens(breadcrumb.message) }),
    ...(breadcrumb.data && { data: redactUrlData(breadcrumb.data) })
  };
}

/** Errors and transactions carry the page URL, the transaction name and span URLs. */
export function redactEventTokens<T extends Event>(event: T): T {
  return {
    ...event,
    ...(event.transaction !== undefined && { transaction: redactUrlTokens(event.transaction) }),
    ...(event.request && { request: redactRequest(event.request) }),
    ...(event.spans && { spans: event.spans.map(redactSpan) }),
    ...(event.contexts?.trace?.data && { contexts: { ...event.contexts, trace: { ...event.contexts.trace, data: redactUrlData(event.contexts.trace.data) } } })
  };
}

function redactRequest(request: NonNullable<Event["request"]>): NonNullable<Event["request"]> {
  return {
    ...request,
    ...(request.url !== undefined && { url: redactUrlTokens(request.url) }),
    ...(typeof request.query_string === "string" && { query_string: redactUrlTokens(request.query_string) }),
    ...(request.headers && { headers: redactHeaders(request.headers) })
  };
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, name.toLowerCase() === "referer" ? redactUrlTokens(value) : value]));
}

function redactSpan<T extends SpanLike>(span: T): T {
  return {
    ...span,
    ...(span.description !== undefined && { description: redactUrlTokens(span.description) }),
    ...(span.data && { data: redactUrlData(span.data) })
  };
}

function redactUrlData<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, URL_DATA_KEYS.includes(key) && typeof value === "string" ? redactUrlTokens(value) : value])
  ) as T;
}
