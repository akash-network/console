import { container } from "tsyringe";

import { ProviderOutagesController } from "@src/controllers/provider-outages/provider-outages.controller";
import { ProviderOutagesRequestSchema, ProviderOutagesResponseSchema } from "@src/http-schemas/provider-outages.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/lib/open-api-hono-handler/open-api-hono-handler";

export const providerOutagesRouter = new OpenApiHonoHandler();

const getProviderOutagesRoute = createRoute({
  method: "get",
  path: "/v1/provider-outages",
  summary: "List providers that are currently unreachable",
  tags: ["Provider Outages"],
  security: [],
  request: {
    query: ProviderOutagesRequestSchema
  },
  responses: {
    200: {
      description: "Returns ongoing outages that started at least minAgeDays ago",
      content: {
        "application/json": {
          schema: ProviderOutagesResponseSchema
        }
      }
    },
    400: {
      description: "Invalid query parameters"
    }
  }
});

providerOutagesRouter.openapi(getProviderOutagesRoute, async function routeGetProviderOutages(c) {
  const request = c.req.valid("query");
  const response = await container.resolve(ProviderOutagesController).getOngoingOutages(request);
  return c.json(response, 200);
});
