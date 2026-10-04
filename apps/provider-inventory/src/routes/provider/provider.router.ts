import { container } from "tsyringe";

import { ProviderController } from "@src/controllers/provider/provider.controller";
import { ProviderParamsSchema, ProviderResponseSchema } from "@src/http-schemas/provider.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/lib/open-api-hono-handler/open-api-hono-handler";

export const providerRouter = new OpenApiHonoHandler();

const getProviderRoute = createRoute({
  method: "get",
  path: "/v1/providers/{owner}",
  summary: "Get what the inventory knows about one provider",
  tags: ["Providers"],
  security: [],
  request: {
    params: ProviderParamsSchema
  },
  responses: {
    200: {
      description: "Returns the provider's inventory record",
      content: {
        "application/json": {
          schema: ProviderResponseSchema
        }
      }
    },
    404: {
      description: "The provider is not in the inventory"
    }
  }
});

providerRouter.openapi(getProviderRoute, async function routeGetProvider(c) {
  const { owner } = c.req.valid("param");
  return c.json(await container.resolve(ProviderController).getProvider(owner), 200);
});
