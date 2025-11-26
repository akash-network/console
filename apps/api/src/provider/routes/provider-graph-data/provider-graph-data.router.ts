import type { Context } from "hono";
import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderGraphDataController } from "@src/provider/controllers/provider-graph-data/provider-graph-data.controller";
import { authorizedDataNames, ProviderGraphDataParamsSchema, ProviderGraphDataResponseSchema } from "@src/provider/http-schemas/provider-graph-data.schema";
import type { ProviderStatsKey } from "@src/types";

export const providerGraphDataRouter = new OpenApiHonoHandler();

const providerGraphDataRoute = createRoute({
  method: "get",
  path: "/v1/provider-graph-data/{dataName}",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  request: {
    params: ProviderGraphDataParamsSchema
  },
  responses: {
    200: {
      description: "Returns provider graph data",
      content: {
        "application/json": {
          schema: ProviderGraphDataResponseSchema
        }
      }
    },
    404: {
      description: "Graph data not found"
    }
  }
});
providerGraphDataRouter.openapi(providerGraphDataRoute, async function routeProviderGraphData(c: Context) {
  const dataName = c.req.param("dataName");

  if (!authorizedDataNames.includes(dataName)) {
    console.log("Rejected graph request: " + dataName);
    return c.text("Graph data not found", 404);
  }

  const response = await container.resolve(ProviderGraphDataController).getProviderGraphData(dataName as ProviderStatsKey);
  return c.json(response);
});
