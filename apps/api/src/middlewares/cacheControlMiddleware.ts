import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // High volatility (short cache)
  "/v1/deployment/": { maxAge: 30, staleWhileRevalidate: 60 },
  "/v1/addresses/": { maxAge: 6, staleWhileRevalidate: 30 },

  // Medium volatility
  "/v1/providers": { maxAge: 60, staleWhileRevalidate: 120 },
  "/v1/dashboard-data": { maxAge: 60, staleWhileRevalidate: 120 },
  "/v1/network-capacity": { maxAge: 15, staleWhileRevalidate: 60 },
  "/v1/gpu": { maxAge: 120, staleWhileRevalidate: 300 },

  // Low volatility (longer cache)
  "/v1/templates": { maxAge: 300, staleWhileRevalidate: 600 },
  "/v1/market-data": { maxAge: 300, staleWhileRevalidate: 600 },
  "/v1/validators": { maxAge: 300, staleWhileRevalidate: 600 },
  "/v1/proposals": { maxAge: 300, staleWhileRevalidate: 600 }
};

export const cacheControlMiddleware = createMiddleware(async (c: Context, next: Next) => {
  await next();

  if (c.req.method !== "GET" || c.res.status !== 200) return;

  const path = c.req.path;
  const config = Object.entries(CACHE_CONFIGS).find(([pattern]) => path.startsWith(pattern))?.[1];

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
