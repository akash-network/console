import type { RouteConfig } from "@hono/zod-openapi";
// eslint-disable-next-line no-restricted-imports
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import { type CacheConfig, cacheControlMiddleware } from "@src/middlewares/cacheControlMiddleware/cacheControlMiddleware";
import { contentTypeMiddleware } from "@src/middlewares/contentTypeMiddleware/contentTypeMiddleware";

export interface ExtendedRouteConfig<R extends RouteConfig> {
  /**
   * HTTP Cache-Control configuration. If not provided, the route will not be cached.
   * Only supported for GET, HEAD, and OPTIONS methods.
   */
  cache?: CacheConfig;
  /**
   * Max size of the body in bytes. If not provided, the body limit will be set to 512Kb.
   * Only supported for POST, PUT, PATCH, and DELETE methods.
   */
  bodyLimit?: Parameters<typeof bodyLimit>[0];
  routeConfig: R;
}

const NO_CACHE = cacheControlMiddleware({ maxAge: 0 });

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

  if (routeConfig.method === "get" || routeConfig.method === "head" || routeConfig.method === "options") {
    middlewares.push(cache ? cacheControlMiddleware(cache) : NO_CACHE);
  }

  if (openApiConfig.middleware) {
    middlewares = middlewares.concat(openApiConfig.middleware);
  }

  if (middlewares.length > 0) {
    openApiConfig.middleware = middlewares;
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "cache">);
}
