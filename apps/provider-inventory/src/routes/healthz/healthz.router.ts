import { container } from "tsyringe";

import { HealthzController } from "@src/controllers/healthz/healthz.controller";
import { HealthzResponseSchema } from "@src/http-schemas/healthz.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const healthzRouter = new OpenApiHonoHandler();

const healthzRoute = createRoute({
  method: "get",
  path: "/healthz",
  summary: "Health check",
  tags: ["Healthz"],
  security: [],
  request: {},
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthzResponseSchema
        }
      }
    },
    503: {
      description: "Service is unhealthy",
      content: {
        "application/json": {
          schema: HealthzResponseSchema
        }
      }
    }
  }
});

healthzRouter.openapi(healthzRoute, async c => {
  const { response, status } = await container.resolve(HealthzController).getStatus();
  return c.json(response, status);
});
