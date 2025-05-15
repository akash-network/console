import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderRegionsController } from "@src/provider/controllers/provider-regions/provider-regions.controller";
import { ProviderRegionsResponseSchema } from "@src/provider/http-schemas/provider-regions.schema";

const route = createRoute({
  method: "get",
  path: "/v1/provider-regions",
  summary: "Get a list of provider regions",
  tags: ["Providers"],
  responses: {
    200: {
      description: "Return a list of provider regions",
      content: {
        "application/json": {
          schema: ProviderRegionsResponseSchema
        }
      }
    }
  }
});

export const providerRegionsRouter = new OpenApiHonoHandler();

providerRegionsRouter.openapi(route, async function routeProviderRegions(c) {
  const response = await container.resolve(ProviderRegionsController).getProviderRegions();
  return c.json(response);
});
