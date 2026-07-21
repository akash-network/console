import type { RouteConfig } from "@hono/zod-openapi";
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

/**
 * OpenAPI vendor extension used to mark a route as hidden from generated
 * documentation. Operations carrying this extension are stripped by
 * `OpenApiDocsService.generateDocs` before the spec is returned.
 */
export const HIDDEN_ROUTES = new Set<string>();

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security: Required<RouteConfig>["security"];
    cache?: CacheConfig;
    bodyLimit?: Parameters<typeof bodyLimit>[0];
    additionalContentTypes?: string[];
    /**
     * Hide this route from the generated OpenAPI document and Swagger UI.
     * The route is still mounted and reachable — only documentation is suppressed.
     */
    hiddenInOpenApiDocs?: boolean;
  }
>(routeConfig: R) {
  const { cache, bodyLimit: bodyLimitOptions, additionalContentTypes, hiddenInOpenApiDocs, ...openApiConfig } = routeConfig;
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

  if (hiddenInOpenApiDocs) {
    HIDDEN_ROUTES.add(openApiConfig.operationId ?? `${openApiConfig.method?.toUpperCase() || "UNKNOWN"} ${openApiConfig.path}`);
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "cache" | "hiddenInOpenApiDocs">);
}
