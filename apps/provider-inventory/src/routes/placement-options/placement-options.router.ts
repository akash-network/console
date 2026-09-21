import { container } from "tsyringe";

import { PlacementOptionsController } from "@src/controllers/placement-options/placement-options.controller";
import { PlacementOptionsResponseSchema } from "@src/http-schemas/placement-options.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/lib/open-api-hono-handler/open-api-hono-handler";

export const placementOptionsRouter = new OpenApiHonoHandler();

const getPlacementOptionsRoute = createRoute({
  method: "get",
  path: "/v1/placement-options",
  summary: "List the regions and GPUs online providers can currently serve",
  tags: ["Placement Options"],
  security: [],
  responses: {
    200: {
      description: "Returns the regions and GPUs available across online providers",
      content: {
        "application/json": {
          schema: PlacementOptionsResponseSchema
        }
      }
    }
  }
});

placementOptionsRouter.openapi(getPlacementOptionsRoute, async function routeGetPlacementOptions(c) {
  const response = await container.resolve(PlacementOptionsController).getPlacementOptions();
  return c.json(response, 200);
});
