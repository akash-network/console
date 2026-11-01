import type { OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { openApiHonoHandlers } from "@src/routers/open-api-handlers";
import internalRoutes, { internalOpenApiHonoHandlers } from "@src/routes/internal";

describe("Declared route security", () => {
  const routesDeclaringSignIn = [
    ...declaredRoutes(openApiHonoHandlers, ""),
    ...declaredRoutes([...internalOpenApiHonoHandlers, ...internalRoutes], "/internal")
  ].filter(route => route.security.length > 0);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds the routes that declare sign-in", () => {
    expect(routesDeclaringSignIn).toContainEqual(expect.objectContaining({ method: "post", path: "/v1/deployments" }));
  });

  it.each(routesDeclaringSignIn)("answers $method $path with 401 when the caller is not signed in", async ({ method, path }) => {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);

    const response = await app.request(path.replace(/\{[^}]+\}/g, "1"), { method: method.toUpperCase() });

    expect(response.status).toBe(401);
  });
});

function declaredRoutes(handlers: Array<Pick<OpenAPIHono, "openAPIRegistry">>, mountPath: string) {
  return handlers.flatMap(handler =>
    handler.openAPIRegistry.definitions.flatMap(definition =>
      definition.type === "route"
        ? [{ method: definition.route.method, path: `${mountPath}${definition.route.path}`, security: definition.route.security ?? [] }]
        : []
    )
  );
}
