import { container } from "tsyringe";

import { StatusResponseSchema } from "@src/http-schemas/status.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";
import { StatusService } from "@src/services/status/status.service";

export const statusRouter = new OpenApiHonoHandler();

const statusRoute = createRoute({
  method: "get",
  path: "/v1/status",
  summary: "Indexer status with per-stream checkpoints",
  tags: ["Status"],
  responses: {
    200: {
      description: "Returns the indexer role, network, and checkpoints",
      content: {
        "application/json": {
          schema: StatusResponseSchema
        }
      }
    }
  }
});

statusRouter.openapi(statusRoute, async function routeGetStatus(c) {
  return c.json(await container.resolve(StatusService).getStatus(), 200);
});
