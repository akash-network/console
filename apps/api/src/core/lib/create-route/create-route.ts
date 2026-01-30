import type { RouteConfig } from "@hono/zod-openapi";
// eslint-disable-next-line no-restricted-imports
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import { contentTypeMiddleware } from "@src/middlewares/contentTypeMiddleware/contentTypeMiddleware";

export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
}

export interface ExtendedRouteConfig<R extends RouteConfig> {
  cache?: CacheConfig;
  /**
   * Max size of the body in bytes. If not provided, the body limit will be set to 512Kb.
   */
  bodyLimit?: Parameters<typeof bodyLimit>[0];
  routeConfig: R;
}

// Registry to store cache configs by path pattern
const cacheConfigRegistry = new Map<string, CacheConfig>();

export function getCacheConfig(path: string): CacheConfig | undefined {
  // Try exact match first (for static paths)
  if (cacheConfigRegistry.has(path)) {
    return cacheConfigRegistry.get(path);
  }

  // Convert Hono's :param format to OpenAPI's {param} format for lookup
  // e.g., /v1/nodes/:network -> /v1/nodes/{network}
  const adjustedPath = path.replace(/:([^/]+)/g, "{$1}");
  return cacheConfigRegistry.get(adjustedPath);
}

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security: Required<RouteConfig>["security"];
    cache?: CacheConfig;
    bodyLimit?: Parameters<typeof bodyLimit>[0];
    additionalContentTypes?: string[];
  }
>(routeConfig: R) {
  const { cache, bodyLimit: bodyLimitOptions, additionalContentTypes, ...openApiConfig } = routeConfig;
  let middlewares: MiddlewareHandler[] = [];

  if (cache) {
    cacheConfigRegistry.set(openApiConfig.path, cache);
  }

  if (routeConfig.method !== "get" && routeConfig.method !== "head") {
    middlewares.push(
      bodyLimit({
        maxSize: 512 * 1024, // 512Kb
        ...bodyLimitOptions
      })
    );
  }

  if (routeConfig.request?.body?.content) {
    const supportedContentTypes = new Set(Object.keys(routeConfig.request.body.content));
    if (additionalContentTypes) {
      for (const ct of additionalContentTypes) {
        supportedContentTypes.add(ct);
      }
    }
    middlewares.push(
      contentTypeMiddleware({
        supportedContentTypes
      })
    );
  }

  if (openApiConfig.middleware) {
    middlewares = middlewares.concat(openApiConfig.middleware);
  }

  if (middlewares.length > 0) {
    openApiConfig.middleware = middlewares;
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "cache">);
}
