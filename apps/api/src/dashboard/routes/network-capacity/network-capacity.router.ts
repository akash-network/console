import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { NetworkCapacityController } from "@src/dashboard/controllers/network-capacity/network-capacity.controller";
import { NetworkCapacityResponseSchema } from "@src/dashboard/http-schemas/network-capacity/network-capacity.schema";

const route = createRoute({
  method: "get",
  path: "/v1/network-capacity",
  tags: ["Analytics"],
  responses: {
    200: {
      description: "Returns network capacity stats",
      content: {
        "application/json": {
          schema: NetworkCapacityResponseSchema
        }
      }
    }
  }
});

export const networkCapacityRouter = new OpenApiHonoHandler();

networkCapacityRouter.openapi(route, async function routeNetworkCapacity(c) {
  const response = await container.resolve(NetworkCapacityController).getNetworkCapacity();
  return c.json(response);
});
