import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DashboardDataController } from "@src/dashboard/controllers/dashboard-data/dashboard-data.controller";
import { DashboardDataResponseSchema } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";

export const dashboardDataRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/dashboard-data",
  tags: ["Analytics"],
  responses: {
    200: {
      description: "Returns dashboard data",
      content: {
        "application/json": {
          schema: DashboardDataResponseSchema
        }
      }
    }
  }
});
dashboardDataRouter.openapi(route, async function routeDashboardData(c) {
  const response = await container.resolve(DashboardDataController).getDashboardData();
  return c.json(response);
});
