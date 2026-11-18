import { container } from "tsyringe";

import { GpuSupplyController } from "@src/controllers/gpu-supply/gpu-supply.controller";
import { GpuSupplyRequestSchema, GpuSupplyResponseSchema } from "@src/http-schemas/gpu-supply.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/lib/open-api-hono-handler/open-api-hono-handler";

export const gpuSupplyRouter = new OpenApiHonoHandler();

const getGpuSupplyRoute = createRoute({
  method: "get",
  path: "/v1/gpu-supply",
  summary: "List the free GPUs of one model on each audited online provider node",
  tags: ["GPU Supply"],
  security: [],
  request: {
    query: GpuSupplyRequestSchema
  },
  responses: {
    200: {
      description: "Returns the provider nodes with free GPUs of the requested model",
      content: {
        "application/json": {
          schema: GpuSupplyResponseSchema
        }
      }
    },
    400: {
      description: "Invalid query parameters"
    }
  }
});

gpuSupplyRouter.openapi(getGpuSupplyRoute, async function routeGetGpuSupply(c) {
  const response = await container.resolve(GpuSupplyController).getGpuSupply(c.req.valid("query"));
  return c.json(response, 200);
});
