import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { HealthzController } from "@src/healthz/controllers/healthz/healthz.controller";

const healthzResponseSchema = z.object({
  data: z.object({
    postgres: z.boolean()
  })
});

export type HealthzResponse = z.infer<typeof healthzResponseSchema>;

const createHealthzRoute = (path: string, type: "readiness" | "liveness") =>
  createOpenApiRoute({
    method: "get",
    path,
    summary: `Get ${type}`,
    tags: ["Healthz"],
    request: {},
    responses: {
      200: {
        description: `Returns ${type} probe with success`,
        content: {
          "application/json": {
            schema: healthzResponseSchema
          }
        }
      },
      500: {
        description: `Returns ${type} probe with error`,
        content: {
          "application/json": {
            schema: healthzResponseSchema
          }
        }
      }
    }
  });

export const healthzRouter = new OpenApiHonoHandler();

healthzRouter.openapi(createHealthzRoute("/v1/healthz/readiness", "readiness"), async function routeGetReadiness(c) {
  const { status, ...response } = await container.resolve(HealthzController).getReadinessStatus();
  return c.json(response, status === "ok" ? 200 : 500);
});

healthzRouter.openapi(createHealthzRoute("/v1/healthz/liveness", "liveness"), async function routeGetLiveness(c) {
  const { status, ...response } = await container.resolve(HealthzController).getLivenessStatus();
  return c.json(response, status === "ok" ? 200 : 500);
});
