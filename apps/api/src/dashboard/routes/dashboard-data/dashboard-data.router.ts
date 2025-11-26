import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { DashboardDataController } from "@src/dashboard/controllers/dashboard-data/dashboard-data.controller";
import { DashboardDataResponseSchema } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";

export const dashboardDataRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/dashboard-data",
  tags: ["Analytics"],
  security: SECURITY_NONE,
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
