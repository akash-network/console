import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { BmeStatusHistoryController } from "@src/dashboard/controllers/bme-status-history/bme-status-history.controller";
import { BmeStatusHistoryResponseSchema } from "@src/dashboard/http-schemas/bme-status-history/bme-status-history.schema";

export const bmeStatusHistoryRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/bme/status-history",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  responses: {
    200: {
      description: "Returns BME circuit breaker status change history",
      content: {
        "application/json": {
          schema: BmeStatusHistoryResponseSchema
        }
      }
    }
  }
});

bmeStatusHistoryRouter.openapi(route, async function routeBmeStatusHistory(c) {
  const statusHistory = await container.resolve(BmeStatusHistoryController).getStatusHistory();

  return c.json(statusHistory);
});
