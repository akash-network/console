import type { IncomingHttpHeaders } from "node:http";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Browsers without fetch metadata still send Origin on writes, so a request with neither header comes from a server, not a page. */
export function isWriteFromAnotherOrigin({ method, headers }: { method?: string; headers: IncomingHttpHeaders }): boolean {
  if (method && SAFE_METHODS.has(method)) return false;

  const fetchSite = headers["sec-fetch-site"];
  if (fetchSite) return fetchSite !== "same-origin";

  return !!headers.origin && hostOf(headers.origin) !== requestHost(headers);
}

function hostOf(origin: string): string | undefined {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

function requestHost(headers: IncomingHttpHeaders): string | undefined {
  const forwardedHost = headers["x-forwarded-host"];
  const firstForwardedHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost?.split(",")[0];

  return firstForwardedHost?.trim() || headers.host;
}
