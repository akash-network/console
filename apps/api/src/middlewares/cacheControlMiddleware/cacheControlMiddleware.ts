import type { Context, Next } from "hono";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";

export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
}

/**
 * Cache control middleware that sets Cache-Control headers based on route config.
 * - Preserves existing Cache-Control headers if already set
 * - Uses "private" for authenticated requests to prevent caching user-specific data publicly
 * - Uses "public" only for unauthenticated requests with cache config
 * - Defaults to "private, no-store" for routes without cache config
 */
export const cacheControlMiddleware = (options?: CacheControlOptions) => async (c: Context, next: Next) => {
  await next();

  if (c.req.method !== "GET" || c.res.status !== 200) return;

  const existingCacheControl = c.res.headers.get("Cache-Control");
  if (existingCacheControl) {
    return;
  }

  const authenticated = container.resolve(AuthService).safeCurrentUser?.userId;
  const cacheScope = authenticated ? "private" : "public";

  if (options?.maxAge) {
    const directives = [
      cacheScope,
      `max-age=${options.maxAge}`,
      options.staleWhileRevalidate ? `stale-while-revalidate=${options.staleWhileRevalidate}` : null
    ].filter(Boolean);

    c.header("Cache-Control", directives.join(", "));
  } else {
    c.header("Cache-Control", `${cacheScope}, no-store`);
  }
};

export interface CacheControlOptions {
  maxAge?: number;
  staleWhileRevalidate?: number;
}
