import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { getCacheConfig } from "@src/core/lib/create-route/create-route";

/**
 * Cache control middleware that sets Cache-Control headers based on route config.
 * Routes with cache config get public caching, others get private no-store.
 */
export const cacheControlMiddleware = createMiddleware(async (c: Context, next: Next) => {
  await next();

  if (c.req.method !== "GET" || c.res.status !== 200) return;

  const config = getCacheConfig(c.req.routePath);

  if (config) {
    const directives = [
      "public",
      `max-age=${config.maxAge}`,
      config.staleWhileRevalidate ? `stale-while-revalidate=${config.staleWhileRevalidate}` : null
    ].filter(Boolean);
    c.header("Cache-Control", directives.join(", "));
  } else {
    c.header("Cache-Control", "private, no-store");
  }
});
