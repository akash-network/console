import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { SinkUnbondingsController } from "@src/dashboard/controllers/sink-unbondings/sink-unbondings.controller";
import { SinkUnbondingsResponseSchema } from "@src/dashboard/http-schemas/sink-unbondings/sink-unbondings.schema";

export const sinkUnbondingsRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/sink/unbondings",
  summary: "Get the staking unbondings alongside the AKT sent to Solana through the sink module",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  responses: {
    200: {
      description: "Returns the daily unbonding and sink amounts and how many sink senders also unbonded",
      content: {
        "application/json": {
          schema: SinkUnbondingsResponseSchema
        }
      }
    }
  }
});

sinkUnbondingsRouter.openapi(route, async function routeSinkUnbondings(c) {
  const response = await container.resolve(SinkUnbondingsController).getUnbondings();
  return c.json(response);
});
