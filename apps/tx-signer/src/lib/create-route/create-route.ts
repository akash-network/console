import type { RouteConfig } from "@hono/zod-openapi";
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security?: Required<RouteConfig>["security"];
  }
>(routeConfig: R) {
  return createOpenApiRoute(routeConfig as Omit<R, "security">);
}
