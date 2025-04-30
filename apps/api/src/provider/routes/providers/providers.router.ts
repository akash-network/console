import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";
import { ProviderListQuerySchema, ProviderListResponseSchema } from "@src/provider/http-schemas/provider.schema";

const route = createRoute({
  method: "get",
  path: "/v1/providers",
  summary: "Get a list of providers.",
  tags: ["Providers"],
  request: {
    query: ProviderListQuerySchema
  },
  responses: {
    200: {
      description: "Returns a list of providers",
      content: {
        "application/json": {
          schema: ProviderListResponseSchema
        }
      }
    }
  }
});

export const providersRouter = new OpenApiHonoHandler();

providersRouter.openapi(route, async function routeListProviders(c) {
  const { scope } = c.req.valid("query");
  const providers = await container.resolve(ProviderController).getProviderList(scope);

  return c.json(providers);
});
