import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { SinkDashboardDataController } from "@src/dashboard/controllers/sink-dashboard-data/sink-dashboard-data.controller";
import { SinkDashboardDataResponseSchema } from "@src/dashboard/http-schemas/sink-dashboard-data/sink-dashboard-data.schema";

export const sinkDashboardDataRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/sink/dashboard-data",
  summary: "Get the totals of AKT transferred to Solana through the sink module",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  responses: {
    200: {
      description: "Returns the current sink totals and the totals of 24 hours earlier",
      content: {
        "application/json": {
          schema: SinkDashboardDataResponseSchema
        }
      }
    }
  }
});

sinkDashboardDataRouter.openapi(route, async function routeSinkDashboardData(c) {
  const response = await container.resolve(SinkDashboardDataController).getDashboardData();
  return c.json(response);
});
