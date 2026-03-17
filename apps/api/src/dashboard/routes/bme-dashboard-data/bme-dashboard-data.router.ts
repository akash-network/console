import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { BmeDashboardDataController } from "@src/dashboard/controllers/bme-dashboard-data/bme-dashboard-data.controller";
import { BmeDashboardDataResponseSchema } from "@src/dashboard/http-schemas/bme-dashboard-data/bme-dashboard-data.schema";

export const bmeDashboardDataRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/bme/dashboard-data",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  responses: {
    200: {
      description: "Returns BME dashboard data",
      content: {
        "application/json": {
          schema: BmeDashboardDataResponseSchema
        }
      }
    }
  }
});

bmeDashboardDataRouter.openapi(route, async function routeBmeDashboardData(c) {
  const response = await container.resolve(BmeDashboardDataController).getDashboardData();
  return c.json(response);
});
