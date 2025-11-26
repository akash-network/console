import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { NetworkCapacityController } from "@src/dashboard/controllers/network-capacity/network-capacity.controller";
import { NetworkCapacityResponseSchema } from "@src/dashboard/http-schemas/network-capacity/network-capacity.schema";

export const networkCapacityRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/network-capacity",
  tags: ["Analytics"],
  security: SECURITY_NONE,
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
