import { headers } from "next/headers";

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
 * Wrapper around fetch that automatically forwards IP-related headers.
 * Use this for all server-side API calls to preserve client IP.
 *
 * @param url - The URL to fetch
 * @param init - Optional fetch init options (headers will be merged)
 * @returns Promise<Response>
 */
export async function serverFetch(url: string, init?: RequestInit): Promise<Response> {
  const ipHeaders = getIpForwardingHeaders();
  const mergedHeaders = new Headers(init?.headers);

  ipHeaders.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  return fetch(url, {
    ...init,
    headers: mergedHeaders
  });
}
