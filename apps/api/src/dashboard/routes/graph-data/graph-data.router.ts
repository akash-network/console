import { createOtelLogger } from "@akashnetwork/logging/otel";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { GraphDataController } from "@src/dashboard/controllers/graph-data/graph-data.controller";
import { GraphDataParamsSchema, GraphDataResponseSchema } from "@src/dashboard/http-schemas/graph-data/graph-data.schema";
import { isValidGraphDataName } from "@src/services/db/statsService";

const logger = createOtelLogger({ context: "GraphDataRouter" });

export const graphDataRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/graph-data/{dataName}",
  tags: ["Analytics"],
  security: SECURITY_NONE,
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
graphDataRouter.openapi(route, async function routeGraphData(c) {
  const { dataName } = c.req.valid("param");

  if (!isValidGraphDataName(dataName)) {
    logger.warn(`Invalid graph data request: ${dataName}`);
    return c.text(`Invalid graph data type: ${dataName}`, 404);
  }

  const graphData = await container.resolve(GraphDataController).getGraphData(dataName);

  return c.json(graphData);
});
