import { container } from "tsyringe";

import { HealthzController } from "@src/controllers/healthz/healthz.controller";
import { HealthzResponseSchema } from "@src/http-schemas/healthz.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/lib/open-api-hono-handler/open-api-hono-handler";

export const healthzRouter = new OpenApiHonoHandler();

const healthzLivenessRoute = createRoute({
  method: "get",
  path: "/private/v1/healthz/liveness",
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

healthzRouter.openapi(healthzLivenessRoute, async c => {
  const { response, status } = await container.resolve(HealthzController).getLivenessStatus();
  return c.json(response, status);
});

const healthzReadinessRoute = createRoute({
  method: "get",
  path: "/private/v1/healthz/readiness",
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

healthzRouter.openapi(healthzReadinessRoute, async c => {
  const { response, status } = await container.resolve(HealthzController).getReadinessStatus();
  return c.json(response, status);
});
