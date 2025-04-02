import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { ProviderController } from "@src/deployment/controllers/provider/provider.controller";

const route = createRoute({
  method: "get",
  path: "/trial-providers",
  tags: ["Trial", "Providers"],
  request: {
    query: z.object({
      registered: z.string().optional()
    })
  },
  summary: "Get a list of trial providers.",
  responses: {
    200: {
      description: "List of trial providers",
      content: {
        "application/json": {
          schema: z.object({
            providers: z.array(
              z.object({
                owner: z.string(),
                hostUri: z.string(),
                availableCPU: z.number(),
                availableGPU: z.number(),
                availableMemory: z.number(),
                availablePersistentStorage: z.number(),
                availableEphemeralStorage: z.number()
              })
            ),
            total: z.object({
              availableCPU: z.number(),
              availableGPU: z.number(),
              availableMemory: z.number(),
              availablePersistentStorage: z.number(),
              availableEphemeralStorage: z.number()
            })
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const { registered } = c.req.query();

  const response = await container.resolve(ProviderController).getTrialProviders(registered === "true");
  return c.json(response, 200);
});
