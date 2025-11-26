import type { RouteConfig } from "@hono/zod-openapi";
// eslint-disable-next-line no-restricted-imports
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security: Required<RouteConfig>["security"];
  }
>(routeConfig: R) {
  return createOpenApiRoute(routeConfig);
}
