import type { RouteConfig } from "@hono/zod-openapi";
import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";

export function createRoute<
  R extends Omit<RouteConfig, "security"> & {
    security?: Required<RouteConfig>["security"];
    bodyLimit?: Parameters<typeof bodyLimit>[0];
  }
>(routeConfig: R): Omit<R, "security" | "bodyLimit"> & { getRoutingPath(): string } {
  const { bodyLimit: bodyLimitOptions, ...openApiConfig } = routeConfig;

  if (bodyLimitOptions) {
    openApiConfig.middleware = [bodyLimit(bodyLimitOptions), ...[openApiConfig.middleware ?? []].flat()];
  }

  return createOpenApiRoute(openApiConfig as Omit<R, "security" | "bodyLimit">);
}
