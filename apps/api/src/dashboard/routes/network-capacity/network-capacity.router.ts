import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { NetworkCapacityController } from "@src/dashboard/controllers/network-capacity/network-capacity.controller";
import { NetworkCapacityResponseSchema } from "@src/dashboard/http-schemas/network-capacity/network-capacity.schema";

export const networkCapacityRouter = new OpenApiHonoHandler();

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
networkCapacityRouter.openapi(route, async function routeNetworkCapacity(c) {
  const response = await container.resolve(NetworkCapacityController).getNetworkCapacity();
  return c.json(response);
});
