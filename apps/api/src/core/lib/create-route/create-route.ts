import type { RouteConfig } from "@hono/zod-openapi";
// eslint-disable-next-line no-restricted-imports
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { PathItemObject, PathsObject } from "openapi3-ts/oas30";

import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";
import { type CacheConfig, cacheControlMiddleware } from "@src/middlewares/cacheControlMiddleware/cacheControlMiddleware";
import { contentTypeMiddleware } from "@src/middlewares/contentTypeMiddleware/contentTypeMiddleware";

export interface ExtendedRouteConfig<R extends RouteConfig> {
  /**
   * HTTP Cache-Control configuration. If not provided, the route will not be cached.
   * Only supported for GET, HEAD, and OPTIONS methods.
   */
  cache?: CacheConfig;
  /**
   * Max size of the body in bytes. If not provided, the body limit will be `DEFAULT_BODY_LIMIT_BYTES`.
   * Only supported for POST, PUT, PATCH, and DELETE methods.
   */
  bodyLimit?: Parameters<typeof bodyLimit>[0];
  routeConfig: R;
}

const NO_CACHE = cacheControlMiddleware({ maxAge: 0 });

/** Operation ids of routes declared with `hiddenInOpenApiDocs`, stripped by `stripHiddenOperations` before any spec is served. */
export const HIDDEN_ROUTES = new Set<string>();

/** Request-body properties, per operation, that are validated as normal but left out of every generated document. */
export const UNDOCUMENTED_REQUEST_FIELDS = new Map<string, readonly string[]>();

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
    /** Request-body properties this route accepts and validates but does not publish, for a capability that works before it is announced. */
    undocumentedRequestFields?: readonly string[];
  }
>(routeConfig: R) {
  const { cache, bodyLimit: bodyLimitOptions, additionalContentTypes, hiddenInOpenApiDocs, undocumentedRequestFields, ...openApiConfig } = routeConfig;
  let middlewares: MiddlewareHandler[] = [];

  if (routeConfig.method !== "get" && routeConfig.method !== "head") {
    middlewares.push(
      bodyLimit({
        maxSize: DEFAULT_BODY_LIMIT_BYTES,
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

  const operationId = openApiConfig.operationId ?? `${openApiConfig.method?.toUpperCase() || "UNKNOWN"} ${openApiConfig.path}`;

  if (hiddenInOpenApiDocs) {
    HIDDEN_ROUTES.add(operationId);
  }

  if (undocumentedRequestFields?.length) {
    UNDOCUMENTED_REQUEST_FIELDS.set(operationId, undocumentedRequestFields);
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "cache" | "hiddenInOpenApiDocs">);
}

/** Every generated spec has to run its paths through this, or `hiddenInOpenApiDocs` silently documents the route it was meant to hide. */
export function stripHiddenOperations(paths: PathsObject | undefined): PathsObject {
  if (!paths) return {};
  const result: PathsObject = {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    let filteredItem: PathItemObject | null = null;
    Object.keys(pathItem).forEach(key => {
      const route = pathItem[key as keyof PathItemObject];
      if (typeof route !== "object" || route === null) return;

      const operationId = route.operationId ?? `${key.toUpperCase()} ${path}`;
      if (!HIDDEN_ROUTES.has(operationId)) {
        filteredItem ??= {};
        filteredItem[key as keyof PathItemObject] = pathItem[key as keyof PathItemObject];
      }
    });
    if (filteredItem) {
      result[path] = filteredItem;
    }
  }
  return result;
}
