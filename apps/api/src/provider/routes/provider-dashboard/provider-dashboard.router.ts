import { createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderDashboardController } from "@src/provider/controllers/provider-dashboard/provider-dashboard.controller";
import { ProviderDashboardParamsSchema, ProviderDashboardResponseSchema } from "@src/provider/http-schemas/provider-dashboard.schema";

const providerDashboardRoute = createRoute({
  method: "get",
  path: "/v1/provider-dashboard/{owner}",
  summary: "Get dashboard data for provider console.",
  tags: ["Providers"],
  request: {
    params: ProviderDashboardParamsSchema
  },
  responses: {
    200: {
      description: "Dashboard data",
      content: {
        "application/json": {
          schema: ProviderDashboardResponseSchema
        }
      }
    },
    404: {
      description: "Provider not found"
    }
  }
});

export const providerDashboardRouter = new OpenApiHonoHandler();

providerDashboardRouter.openapi(providerDashboardRoute, async function routeProviderDashboard(c: Context) {
  const owner = c.req.param("owner");

  const response = await container.resolve(ProviderDashboardController).getProviderDashboard(owner);
  return c.json(response);
});
