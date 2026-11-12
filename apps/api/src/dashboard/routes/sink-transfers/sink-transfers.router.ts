import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { SinkTransfersController } from "@src/dashboard/controllers/sink-transfers/sink-transfers.controller";
import { SinkTransfersQuerySchema, SinkTransfersResponseSchema } from "@src/dashboard/http-schemas/sink-transfers/sink-transfers.schema";

export const sinkTransfersRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/sink/transfers",
  summary: "Get the AKT transfers sent to Solana through the sink module",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  request: {
    query: SinkTransfersQuerySchema
  },
  responses: {
    200: {
      description: "Returns a page of sink transfers and the total number of transfers",
      content: {
        "application/json": {
          schema: SinkTransfersResponseSchema
        }
      }
    }
  }
});

sinkTransfersRouter.openapi(route, async function routeSinkTransfers(c) {
  const response = await container.resolve(SinkTransfersController).getTransfers(c.req.valid("query"));
  return c.json(response);
});
