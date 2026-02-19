import { headers } from "next/headers";

import { errorHandler } from "@/services/di";

/**
 * Extracts IP-related headers from Next.js request headers to forward to API requests.
 * This preserves the real client IP address when making server-side API calls.
 *
 * @returns Record of headers to forward (cf-connecting-ip and/or x-forwarded-for)
 */
export function getIpForwardingHeaders(): Headers {
  const requestHeaders = headers();
  const headersToForward = new Headers();

  const cfConnectingIp = requestHeaders.get("cf-connecting-ip");
  const xForwardedFor = requestHeaders.get("x-forwarded-for");

  if (cfConnectingIp) {
    headersToForward.set("cf-connecting-ip", cfConnectingIp);
  }
  if (xForwardedFor) {
    headersToForward.set("x-forwarded-for", xForwardedFor);
  }

  return headersToForward;
}

/**
 * Gets Sentry trace data and converts to W3C traceparent format for distributed tracing
 */
export function getTraceparentHeaders(): Headers {
  const headersToForward = new Headers();
  const traceData = errorHandler.getTraceData();

  if (traceData.traceIdW3C) {
    headersToForward.set("traceparent", traceData.traceIdW3C);
  }
  if (traceData.baggage) {
    headersToForward.set("baggage", traceData.baggage);
  }

  return headersToForward;
}

/**
 * Wrapper around fetch that automatically forwards IP-related headers and distributed tracing headers.
 * Use this for all server-side API calls to preserve client IP and enable distributed tracing.
 *
 * @param url - The URL to fetch
 * @param init - Optional fetch init options (headers will be merged)
 * @returns Promise<Response>
 */
export async function serverFetch(url: string, init?: RequestInit): Promise<Response> {
  const ipHeaders = getIpForwardingHeaders();
  const traceHeaders = getTraceparentHeaders();
  const mergedHeaders = new Headers(init?.headers);

  ipHeaders.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  traceHeaders.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      headers: mergedHeaders,
      signal: init?.signal ?? controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
