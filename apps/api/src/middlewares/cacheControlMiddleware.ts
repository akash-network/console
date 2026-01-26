import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { getCacheConfig } from "@src/core/lib/create-route/create-route";
import { getPayloadFromContext } from "@src/verify-rsa-jwt-cloudflare-worker-main";

/**
 * Determines if the current request is authenticated.
 * Checks for Authorization header or validated JWT payload in context.
 */
function isAuthenticated(c: Context): boolean {
  const authHeader = c.req.header("authorization");
  if (authHeader) {
    return true;
  }

  const payload = getPayloadFromContext(c);
  return payload !== null && payload !== undefined;
}

/**
 * Cache control middleware that sets Cache-Control headers based on route config.
 * - Preserves existing Cache-Control headers if already set
 * - Uses "private" for authenticated requests to prevent caching user-specific data publicly
 * - Uses "public" only for unauthenticated requests with cache config
 * - Defaults to "private, no-store" for routes without cache config
 */
export const cacheControlMiddleware = createMiddleware(async (c: Context, next: Next) => {
  await next();

  if (c.req.method !== "GET" || c.res.status !== 200) return;

  const existingCacheControl = c.res.headers.get("Cache-Control");
  if (existingCacheControl) {
    return;
  }

  const config = getCacheConfig(c.req.routePath);

  if (config) {
    const authenticated = isAuthenticated(c);
    const cacheScope = authenticated ? "private" : "public";

    const directives = [
      cacheScope,
      `max-age=${config.maxAge}`,
      config.staleWhileRevalidate ? `stale-while-revalidate=${config.staleWhileRevalidate}` : null
    ].filter(Boolean);

    c.header("Cache-Control", directives.join(", "));
  } else {
    c.header("Cache-Control", "private, no-store");
  }
});
