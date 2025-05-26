import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { GraphDataController } from "@src/dashboard/controllers/graph-data/graph-data.controller";
import { GraphDataParamsSchema, GraphDataResponseSchema } from "@src/dashboard/http-schemas/graph-data/graph-data.schema";
import { isValidGraphDataName } from "@src/services/db/statsService";

const route = createRoute({
  method: "get",
  path: "/v1/graph-data/{dataName}",
  tags: ["Analytics"],
  request: {
    params: GraphDataParamsSchema
  },
  responses: {
    200: {
      description: "Returns graph data",
      content: {
        "application/json": {
          schema: GraphDataResponseSchema
        }
      }
    },
    404: {
      description: "Graph data not found"
    }
  }
});

export const graphDataRouter = new OpenApiHonoHandler();

graphDataRouter.openapi(route, async function routeGraphData(c) {
  const { dataName } = c.req.valid("param");

  if (!isValidGraphDataName(dataName)) {
    console.log("Rejected graph request: " + dataName);
    return c.text("Graph not found: " + dataName, 404);
  }

  const graphData = await container.resolve(GraphDataController).getGraphData(dataName);

  return c.json(graphData);
});
