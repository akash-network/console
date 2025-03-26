import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { FeaturesController } from "@src/features/controllers/features.controller";

const route = createRoute({
  method: "get",
  path: "/v1/features",
  summary: "Returns enabled feature flags",
  tags: ["Feature flags"],

  responses: {
    200: {
      description: "List of enabled feature flags",
      content: {
        "application/json": {
          schema: z.object({
            data: z.record(z.boolean())
          })
        }
      }
    }
  }
});

export const featuresRouter = new OpenApiHonoHandler();

featuresRouter.openapi(route, async function routeGetFeatures(c) {
  const data = await container.resolve(FeaturesController).getFeatures();
  return c.json({ data });
});
