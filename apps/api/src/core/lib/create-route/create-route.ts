import type { RouteConfig } from "@hono/zod-openapi";
// eslint-disable-next-line no-restricted-imports
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";

export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
}

export interface ExtendedRouteConfig<R extends RouteConfig> {
  cache?: CacheConfig;
  routeConfig: R;
}

// Registry to store cache configs by path pattern
const cacheConfigRegistry = new Map<string, CacheConfig>();

export function getCacheConfig(path: string): CacheConfig | undefined {
  // Try exact match first
  if (cacheConfigRegistry.has(path)) {
    return cacheConfigRegistry.get(path);
  }

  // Try pattern matching (for paths with parameters like /v1/providers/{address})
  for (const [pattern, config] of cacheConfigRegistry.entries()) {
    const regexPattern = pattern.replace(/\{[^}]+\}/g, "[^/]+").replace(/\//g, "\\/");
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(path)) {
      return config;
    }
  }

  return undefined;
}

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security: Required<RouteConfig>["security"];
    cache?: CacheConfig;
  }
>(routeConfig: R) {
  const { cache, ...openApiConfig } = routeConfig;

  if (cache) {
    cacheConfigRegistry.set(openApiConfig.path, cache);
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "cache">);
}
