import { HealthzResponseSchema } from "@src/http-schemas/healthz.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const healthzRouter = new OpenApiHonoHandler();

const healthzRoute = createRoute({
  method: "get",
  path: "/v1/healthz",
  summary: "Health check",
  tags: ["Healthz"],
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

healthzRouter.openapi(healthzRoute, async function routeGetHealthz(c) {
  return c.json({ data: { status: "ok" as const } }, 200);
});
