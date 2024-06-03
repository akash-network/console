import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getNetworkCapacity } from "@src/services/db/providerStatusService";

const route = createRoute({
  method: "get",
  path: "/network-capacity",
  tags: ["Analytics"],
  responses: {
    200: {
      description: "Returns network capacity stats",
      content: {
        "application/json": {
          schema: z.object({
            activeProviderCount: z.number(),
            activeCPU: z.number(),
            activeGPU: z.number(),
            activeMemory: z.number(),
            activeStorage: z.number(),
            pendingCPU: z.number(),
            pendingGPU: z.number(),
            pendingMemory: z.number(),
            pendingStorage: z.number(),
            availableCPU: z.number(),
            availableGPU: z.number(),
            availableMemory: z.number(),
            availableStorage: z.number(),
            totalCPU: z.number(),
            totalGPU: z.number(),
            totalMemory: z.number(),
            totalStorage: z.number()
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const networkCapacity = await getNetworkCapacity();
  return c.json(networkCapacity);
});
