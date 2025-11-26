import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderRegionsController } from "@src/provider/controllers/provider-regions/provider-regions.controller";
import { ProviderRegionsResponseSchema } from "@src/provider/http-schemas/provider-regions.schema";

export const providerRegionsRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/provider-regions",
  summary: "Get a list of provider regions",
  tags: ["Providers"],
  security: SECURITY_NONE,
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
providerRegionsRouter.openapi(route, async function routeProviderRegions(c) {
  const response = await container.resolve(ProviderRegionsController).getProviderRegions();
  return c.json(response);
});
