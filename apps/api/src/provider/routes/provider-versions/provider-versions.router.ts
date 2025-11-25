import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderVersionsController } from "@src/provider/controllers/provider-versions/provider-versions.controller";
import { ProviderVersionsResponseSchema } from "@src/provider/http-schemas/provider-versions.schema";

export const providerVersionsRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/provider-versions",
  summary: "Get providers grouped by version.",
  tags: ["Providers"],
  responses: {
    200: {
      description: "List of providers grouped by version.",
      content: {
        "application/json": {
          schema: ProviderVersionsResponseSchema
        }
      }
    }
  }
});
providerVersionsRouter.openapi(route, async function routeProviderVersions(c) {
  const providerVersions = await container.resolve(ProviderVersionsController).getProviderVersions();

  return c.json(providerVersions);
});
