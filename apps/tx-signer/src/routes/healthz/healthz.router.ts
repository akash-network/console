import { container } from "tsyringe";

import { HealthzController } from "@src/controllers/healthz/healthz.controller";
import { HealthzResponseSchema } from "@src/http-schemas/healthz/healthz.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const healthzRouter = new OpenApiHonoHandler();

const healthzRoute = createRoute({
  method: "get",
  path: "/healthz",
  summary: "Health check",
  tags: ["Healthz"],
  request: {},
  responses: {
    200: {
      description: "Returns ok",
      content: {
        "application/json": {
          schema: HealthzResponseSchema
        }
      }
    }
  }
});

healthzRouter.openapi(healthzRoute, async c => {
  const payload = await container.resolve(HealthzController).getStatus();
  return c.json(payload, 200);
});
